import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import type { Doc } from "../../convex/_generated/dataModel";
import { subscriptionChanges } from "../../convex/statistics/subscriptions";
import { date } from "../../convex/statistics/history";
import { mentions } from "../../convex/news/mentions";

/** Complete set of converted tables required before the application can resume. */
const tables = [
    "newsMentions",
    "subscriptions",
    "messages",
    "messageContents",
    "mailRecipients",
    "campaigns",
    "campaignContents",
    "communityTotals",
    "subscriptionDays",
    "eventCounts",
    "registrationDays",
    "mailDispatcher",
] as const;

/** Stored message before rendered bodies moved out of the queue. */
export type LegacyMessage = Doc<"messages"> & { text: string; html?: string };

/** Stored campaign before its content and audience were separated from progress. */
export type LegacyCampaign = Omit<Doc<"campaigns">, "hasContent" | "recipientCount"> &
    Pick<Doc<"campaignContents">, "message" | "content" | "recipients">;

/** Subscription before provider outcomes moved to their own records. */
export type LegacySubscription = Doc<"subscriptions"> &
    Partial<Pick<Doc<"mailRecipients">, "deliveredAt" | "hasDeliveryFailure">>;

/** Table row before Convex assigns its new document identity. */
type Fields<
    Table extends "mailRecipients" | "subscriptionDays" | "eventCounts" | "registrationDays",
> = Omit<Doc<Table>, "_id" | "_creationTime">;

/** Preserve message identity, attempts and provider keys while separating its exact bytes. */
export function migrateMessage(source: LegacyMessage) {
    const { text, html, ...message } = source;
    if (typeof text !== "string" || (html !== undefined && typeof html !== "string"))
        throw new Error("legacy message content is missing or invalid");

    return { message, content: { messageId: message._id, text, html } };
}

/** Preserve campaign approvals and recipient order exactly. */
export function migrateCampaign(source: LegacyCampaign) {
    const { message, content, recipients, ...campaign } = source;
    if (typeof message !== "string") throw new Error("legacy campaign prose is missing");

    return {
        campaign: {
            ...campaign,
            hasContent: content ? true : undefined,
            recipientCount: recipients?.length,
        },
        content: { campaignId: campaign._id, message, content, recipients },
    };
}

/** Build aggregate tables from the same dated contributions used by live writes. */
export class Statistics {
    /** Current eligible subscriber count. */
    subscribers: number;
    /** Dated subscription changes. */
    subscriptions: Map<string, Fields<"subscriptionDays">>;
    /** Per-event calendar counts. */
    events: Map<string, Fields<"eventCounts">>;
    /** Dated registration counts, keyed by event and date. */
    registrations: Map<string, Fields<"registrationDays">>;

    /** Start an empty reconstruction from the source backup. */
    constructor() {
        this.subscribers = 0;
        this.subscriptions = new Map();
        this.events = new Map();
        this.registrations = new Map();
    }

    /** Add one source subscription without treating suppression as a historical departure. */
    addSubscription(subscription: Doc<"subscriptions">) {
        this.subscribers += Number(subscription.status === "subscribed");
        for (const [date, change] of subscriptionChanges(subscription)) {
            const row = this.subscriptions.get(date) ?? {
                date,
                change: 0,
                observations: 0,
                estimates: 0,
            };
            row.change += change.change;
            row.observations += change.observations;
            row.estimates += change.estimates;
            this.subscriptions.set(date, row);
        }
    }

    /** Add one registration, retaining cancelled records in historical signup totals. */
    addRegistration(registration: Doc<"registrations">) {
        const eventId = registration.eventId;
        const event = this.events.get(eventId) ?? { eventId, total: 0, going: 0, waitlist: 0 };
        event.total++;
        event.going += Number(registration.status === "going");
        event.waitlist += Number(registration.status === "waitlist");
        this.events.set(eventId, event);

        // retain date changes from genuine re-registration in the same way as the current query
        const day = date(registration.createdAt);
        const key = `${eventId}:${day}`;
        const row = this.registrations.get(key) ?? { eventId, date: day, count: 0 };
        row.count++;
        this.registrations.set(key, row);
    }
}

/** Stream a table from an extracted Convex backup without retaining rendered bodies in memory. */
async function* rows<T>(directory: string, table: string) {
    const stream = createReadStream(join(directory, table, "documents.jsonl"), {
        encoding: "utf8",
    });
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of lines) {
        if (!line.trim()) continue;

        yield JSON.parse(line) as T;
    }
}

/** Write private, hashed JSONL files without overwriting an earlier conversion. */
export async function prepare(source: string, destination: string) {
    if (resolve(source) === resolve(destination))
        throw new Error("source and destination must differ");
    await mkdir(destination, { mode: 0o700 });
    const manifest: Record<string, { rows: number; sha256: string }> = {};

    /** Write one transformed table and retain only its count and hash in the report. */
    async function write(table: string, records: AsyncIterable<unknown> | Iterable<unknown>) {
        const path = join(destination, `${table}.jsonl`);
        await writeFile(path, "", { mode: 0o600, flag: "wx" });
        const writer = Bun.file(path).writer();
        const hash = createHash("sha256");
        let count = 0;
        try {
            for await (const row of records) {
                const line = `${JSON.stringify(row)}\n`;
                writer.write(line);
                hash.update(line);
                count++;
            }
        } finally {
            await writer.end();
        }
        manifest[table] = { rows: count, sha256: hash.digest("hex") };
    }

    // rebuild provider history independently of consent, preserving adverse outcomes
    const recipients = new Map<string, Fields<"mailRecipients">>();
    const statistics = new Statistics();
    async function* subscriptions() {
        for await (const sourceRow of rows<LegacySubscription>(source, "subscriptions")) {
            const { deliveredAt, hasDeliveryFailure, ...subscription } = sourceRow;
            statistics.addSubscription(subscription);
            if (deliveredAt !== undefined || hasDeliveryFailure)
                recipients.set(subscription.email, {
                    email: subscription.email,
                    deliveredAt,
                    hasDeliveryFailure: !!hasDeliveryFailure,
                });

            yield subscription;
        }
    }
    await write("subscriptions", subscriptions());

    // stream bodies twice rather than hold a campaign archive in memory
    async function* messages(content: boolean) {
        for await (const row of rows<LegacyMessage>(source, "messages")) {
            const result = migrateMessage(row);
            if (!content && !row.isTest) {
                const hasFailure =
                    row.status === "failed" ||
                    ["bounced", "complained", "failed", "suppressed"].includes(row.outcome ?? "");
                const deliveredAt = row.outcome === "delivered" ? row.firstAttemptAt : undefined;
                if (hasFailure || deliveredAt !== undefined) {
                    const previous = recipients.get(row.to);
                    recipients.set(row.to, {
                        email: row.to,
                        hasDeliveryFailure: !!previous?.hasDeliveryFailure || hasFailure,
                        deliveredAt:
                            deliveredAt === undefined
                                ? previous?.deliveredAt
                                : Math.max(previous?.deliveredAt ?? 0, deliveredAt),
                    });
                }
            }

            yield content ? result.content : result.message;
        }
    }
    await write("messages", messages(false));
    await write("messageContents", messages(true));
    await write("mailRecipients", recipients.values());

    // preserve audience order, approvals, progress, snapshots and original IDs
    async function* campaigns(content: boolean) {
        for await (const row of rows<LegacyCampaign>(source, "campaigns")) {
            const result = migrateCampaign(row);

            yield content ? result.content : result.campaign;
        }
    }
    await write("campaigns", campaigns(false));
    await write("campaignContents", campaigns(true));
    for await (const row of rows<Doc<"registrations">>(source, "registrations"))
        statistics.addRegistration(row);
    await write("communityTotals", [{ subscribers: statistics.subscribers }]);
    await write("subscriptionDays", statistics.subscriptions.values());
    await write("eventCounts", statistics.events.values());
    await write("registrationDays", statistics.registrations.values());
    await write("mailDispatcher", []);

    // rebuild organisation previews from published snapshots only
    async function* news() {
        for await (const post of rows<Doc<"posts">>(source, "posts")) yield* mentions(post);
    }
    await write("newsMentions", news());

    // a complete manifest is written only after every table succeeds
    await writeFile(join(destination, "manifest.json"), JSON.stringify(manifest, null, 2), {
        mode: 0o600,
        flag: "wx",
    });

    return manifest;
}

/** Verify every prepared byte before any separately authorised import. */
export async function verify(directory: string) {
    const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8")) as Record<
        string,
        { rows: number; sha256: string }
    >;
    if (Object.keys(manifest).length !== tables.length || tables.some((table) => !manifest[table]))
        throw new Error("migration manifest is incomplete");
    for (const [table, expected] of Object.entries(manifest)) {
        const hash = createHash("sha256");
        const stream = createReadStream(join(directory, `${table}.jsonl`));
        let count = 0;
        for await (const chunk of stream) {
            hash.update(chunk);
            for (const byte of chunk) if (byte === 10) count++;
        }
        if (hash.digest("hex") !== expected.sha256)
            throw new Error(`migration file changed: ${table}`);
        if (count !== expected.rows) throw new Error(`migration row count differs: ${table}`);
    }
    if (
        manifest.messages.rows !== manifest.messageContents.rows ||
        manifest.campaigns.rows !== manifest.campaignContents.rows ||
        manifest.communityTotals.rows !== 1 ||
        manifest.mailDispatcher.rows !== 0
    )
        throw new Error("migration table counts disagree");

    return manifest;
}

if (import.meta.main) {
    const [source, destination] = process.argv.slice(2);
    if (!source || !destination)
        throw new Error(
            "usage: bun scripts/migrations/mail.ts <extracted-backup> <new-output-directory>",
        );
    await prepare(source, destination);
    console.log(await verify(destination));
}
