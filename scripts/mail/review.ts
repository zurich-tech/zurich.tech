import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import type { Doc } from "../../convex/_generated/dataModel";
import { prioritize } from "./order";

/** Preview or release verified, untouched introductions through the bounded queue operation. */
function main() {
    const [campaignId, auditPath, mode] = process.argv.slice(2);
    if (!campaignId || !auditPath || (mode !== undefined && mode !== "--apply"))
        throw new Error("Usage: bun scripts/mail/review.ts <campaign-id> <audit.json> [--apply]");
    const audit: { email: string; state: string; score: number }[] = JSON.parse(
        readFileSync(auditPath, "utf8"),
    );
    const verified = new Map<string, number>();
    for (const row of audit) {
        if (row.state !== "deliverable") continue;
        if (!Number.isFinite(row.score) || row.score < 0 || row.score > 100)
            throw new Error("Invalid verification score.");
        const email = row.email.trim().toLowerCase();
        if (verified.has(email)) throw new Error("Duplicate verification record.");
        verified.set(email, row.score);
    }

    // exclude contact history by both normalized address and linked member identity
    const subscriptions = new Map(
        read<Doc<"subscriptions">>("subscriptions").map((row) => [row._id, row]),
    );
    const messages = read<Doc<"messages">>("messages");
    const contacted = new Set<string>();
    for (const message of messages) {
        if (message.isTest || (message.attempts === 0 && message.firstAttemptAt === undefined))
            continue;
        contacted.add(message.to.trim().toLowerCase());
        const memberId = message.subscriptionId
            ? subscriptions.get(message.subscriptionId)?.memberId
            : undefined;
        if (memberId) contacted.add(memberId);
    }
    const candidates = messages.filter((message) => {
        const subscription = message.subscriptionId
            ? subscriptions.get(message.subscriptionId)
            : undefined;
        const email = message.to.trim().toLowerCase();
        return (
            message.campaignId === campaignId &&
            verified.has(email) &&
            message.firstAttemptAt === undefined &&
            !message.claimedAt &&
            subscription?.status === "subscribed" &&
            !!subscription.token &&
            !subscription.hasDeliveryFailure &&
            subscription.deliveredAt === undefined &&
            !(subscription.weekly === false && subscription.announcements === false) &&
            !contacted.has(email) &&
            !(subscription.memberId && contacted.has(subscription.memberId))
        );
    });

    // rank verification confidence first, then actual event activity and stable queue order
    const events = new Map(
        read<Doc<"events">>("events")
            .filter(
                (event) =>
                    event.startsAt < Date.now() && !["draft", "cancelled"].includes(event.status),
            )
            .map((event) => [event._id, event]),
    );
    const ranked = prioritize(
        candidates,
        events,
        read<Doc<"registrations">>("registrations"),
        subscriptions,
    ).sort(
        (left, right) =>
            verified.get(right.message.to.trim().toLowerCase())! -
            verified.get(left.message.to.trim().toLowerCase())!,
    );
    const identities = new Set<string>();
    const unique = ranked.filter((row) => {
        const subscription = subscriptions.get(row.message.subscriptionId!)!;
        const keys = [
            row.message.to.trim().toLowerCase(),
            ...(subscription.memberId ? [subscription.memberId] : []),
        ];
        if (keys.some((key) => identities.has(key))) return false;
        keys.forEach((key) => identities.add(key));
        return true;
    });
    const selected = unique.slice(0, 100);
    if (!selected.length) throw new Error("No verified untouched recipients remain.");
    console.log(
        JSON.stringify({
            eligible: unique.length,
            selected: selected.length,
            scores: selected.reduce<Record<string, number>>((counts, row) => {
                const score = verified.get(row.message.to.trim().toLowerCase())!;
                counts[score] = (counts[score] ?? 0) + 1;
                return counts;
            }, {}),
        }),
    );

    // revalidate in the database immediately before admitting this exact batch
    const args = {
        campaignId,
        messageIds: selected.map((row) => row.message._id),
        source: "Emailable 2026-09-30 deliverable audit; score descending, then event activity",
        isDryRun: true,
    };
    console.log(
        JSON.stringify(run(["run", "--prod", "mail/ordering:release", JSON.stringify(args)])),
    );
    if (mode === "--apply")
        console.log(
            JSON.stringify(
                run([
                    "run",
                    "--prod",
                    "mail/ordering:release",
                    JSON.stringify({ ...args, isDryRun: false }),
                ]),
            ),
        );
}

/** Read a complete bounded table without exposing personal records in command output. */
function read<T>(table: string): T[] {
    const rows = run(["data", table, "--prod", "--limit", "10000", "--format", "json"]) as T[];
    if (rows.length >= 10000) throw new Error("Export reached its limit; use pagination.");
    return rows;
}

/** Run an authenticated operation while keeping message bodies and addresses private. */
function run(args: string[]): unknown {
    const result = spawnSync("bunx", ["convex", ...args], {
        encoding: "utf8",
        maxBuffer: 80000000,
    });
    if (result.status !== 0)
        throw new Error("Convex operation failed; no further release attempted.");
    return JSON.parse(result.stdout);
}

main();
