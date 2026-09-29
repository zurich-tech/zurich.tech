import { spawnSync } from "node:child_process";
import type { Doc } from "../../convex/_generated/dataModel";

/** Rank untouched messages by historical event date, frequency and their existing queue order. */
export function prioritize(
    queued: Doc<"messages">[],
    events: Map<Doc<"events">["_id"], Doc<"events">>,
    registrations: Doc<"registrations">[],
    subscriptions: Map<Doc<"subscriptions">["_id"], Doc<"subscriptions">>,
) {
    // match both addresses and linked accounts without counting the same event twice
    const identities = new Map<string, Set<Doc<"events">["_id"]>>();
    for (const row of registrations) {
        if (!events.has(row.eventId) || ["cancelled", "declined"].includes(row.status)) continue;
        for (const key of [
            row.email.trim().toLowerCase(),
            ...(row.memberId ? [row.memberId] : []),
        ]) {
            const matches = identities.get(key) ?? new Set<Doc<"events">["_id"]>();
            matches.add(row.eventId);
            identities.set(key, matches);
        }
    }

    return queued
        .filter((row) => row.attempts === 0 && row.status === "queued" && !row.isTest)
        .sort(
            (left, right) =>
                left.nextAttemptAt - right.nextAttemptAt ||
                left._creationTime - right._creationTime,
        )
        .map((message) => {
            const subscription = message.subscriptionId
                ? subscriptions.get(message.subscriptionId)
                : undefined;
            const matches = new Set([
                ...(identities.get(message.to.trim().toLowerCase()) ?? []),
                ...(subscription?.memberId ? (identities.get(subscription.memberId) ?? []) : []),
            ]);

            return {
                message,
                events: matches.size,
                latest: Math.max(0, ...[...matches].map((id) => events.get(id)!.startsAt)),
            };
        })
        .sort((left, right) => right.latest - left.latest || right.events - left.events);
}

/** Preview or apply historical-event ordering without granting permission to send. */
async function main() {
    const [campaignId, seriesSlug, mode] = process.argv.slice(2);
    if (!campaignId || !seriesSlug || (mode !== undefined && mode !== "--apply"))
        throw new Error("Usage: bun scripts/mail/order.ts <campaign-id> <series-slug> [--apply]");

    // export records locally so message bodies do not exceed one Convex transaction's read limit
    const series = read<Doc<"series">>("series").find((row) => row.slug === seriesSlug);
    if (!series) throw new Error("Series not found.");
    const now = Date.now();
    const events = new Map(
        read<Doc<"events">>("events")
            .filter(
                (event) =>
                    event.seriesId === series._id &&
                    event.startsAt < now &&
                    !["draft", "cancelled"].includes(event.status),
            )
            .map((event) => [event._id, event]),
    );
    if (!events.size) throw new Error("No published past events in this series.");
    const subscriptions = new Map(
        read<Doc<"subscriptions">>("subscriptions").map((row) => [row._id, row]),
    );
    const registrations = read<Doc<"registrations">>("registrations");
    const messages = read<Doc<"messages">>("messages");
    const queued = messages.filter(
        (row) => row.campaignId === campaignId && row.status === "queued" && !row.isTest,
    );

    // rank only untouched messages, preserving ties and unrelated recipients in their existing order
    const ranked = prioritize(queued, events, registrations, subscriptions);
    const first = Math.min(now, ...queued.map((row) => row.nextAttemptAt)) - ranked.length;

    // print aggregate preview only, never recipient addresses or personalised message bodies
    const dates: Record<string, number> = {};
    for (const row of ranked.slice(0, 100)) {
        const date = row.latest ? new Date(row.latest).toISOString().slice(0, 10) : "none";
        dates[date] = (dates[date] ?? 0) + 1;
    }
    console.log(
        JSON.stringify({
            mode: mode ?? "preview",
            queued: queued.length,
            reordered: ranked.length,
            retriesUnchanged: queued.length - ranked.length,
            matched: ranked.filter((row) => row.events).length,
            next100: {
                count: Math.min(100, ranked.length),
                dates,
                repeat: ranked.slice(0, 100).filter((row) => row.events > 1).length,
            },
        }),
    );

    // recheck stopped sending in every transaction; any failure leaves the campaign stopped
    if (mode === "--apply") {
        for (let offset = 0; offset < ranked.length; offset += 100) {
            run([
                "run",
                "--prod",
                "mail/ordering:apply",
                JSON.stringify({
                    campaignId,
                    messageIds: ranked.slice(offset, offset + 100).map((row) => row.message._id),
                    first: first + offset,
                }),
            ]);
        }
        const actual = read<Doc<"messages">>("messages");
        const positions = new Map(actual.map((row) => [row._id, row]));
        for (const [index, row] of ranked.entries()) {
            const message = positions.get(row.message._id);
            if (
                !message ||
                message.status !== "queued" ||
                message.attempts !== 0 ||
                message.nextAttemptAt !== first + index
            )
                throw new Error("Queue verification failed. Keep sending stopped.");
        }
        console.log("Verified queue order. Sending allowance unchanged.");
    }
}

/** Read a bounded community table, failing rather than silently truncating it. */
function read<T>(table: string): T[] {
    const rows = run(["data", table, "--prod", "--limit", "10000", "--format", "json"]) as T[];
    if (rows.length >= 10000) throw new Error("Export reached its limit; use a paginated export.");
    return rows;
}

/** Run the authenticated CLI without printing potentially sensitive output on failure. */
function run(args: string[]): unknown {
    const result = spawnSync("bunx", ["convex", ...args], {
        encoding: "utf8",
        maxBuffer: 80000000,
    });
    if (result.status !== 0)
        throw new Error("Convex operation failed; sending allowance was not changed.");
    return JSON.parse(result.stdout);
}

if (import.meta.main) await main();
