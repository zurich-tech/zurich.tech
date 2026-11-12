import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Id } from "../convex/_generated/dataModel";
import {
    migrateMessage,
    migrateCampaign,
    prepare,
    verify,
    type LegacyMessage,
    type LegacyCampaign,
} from "../scripts/migrations/mail";

/** Stable identifiers model the preserved references in an exported backup. */
const messageId = "message-one" as Id<"messages">;
const campaignId = "campaign-one" as Id<"campaigns">;
const subscriptionId = "subscription-one" as Id<"subscriptions">;

/** A partially delivered campaign with exact content and recipient ordering. */
const campaign: LegacyCampaign = {
    _id: campaignId,
    _creationTime: 100,
    subject: "Subject",
    message: "Original prose",
    content: { subject: "Subject", text: "Original text", html: "<p>Original text</p>" },
    recipients: [subscriptionId],
    category: "campaign",
    status: "queued",
    cursor: 1,
    attempts: 1,
    attemptLimit: 2,
    accepted: 1,
    finished: 1,
    nextAttemptAt: 500,
    createdAt: 100,
    updatedAt: 200,
};

/** An accepted email whose provider identity must survive conversion. */
const message: LegacyMessage = {
    _id: messageId,
    _creationTime: 101,
    key: "stable-provider-key",
    to: "person@example.invalid",
    subject: "Subject",
    text: "Exact text\n",
    html: "<p>Exact &amp; original</p>\n",
    campaignId,
    subscriptionId,
    status: "accepted",
    outcome: "delivered",
    isBulk: true,
    category: "campaign",
    attempts: 1,
    firstAttemptAt: 200,
    nextAttemptAt: 500,
    providerId: "provider-one",
    sentAt: 201,
    createdAt: 101,
};

test("test_split_archive_records_without_changing_content_delivery_or_approval", () => {
    const { text, html, ...operational } = message;
    expect(migrateMessage(message)).toEqual({
        message: operational,
        content: { messageId, text, html },
    });
    const { message: prose, content, recipients, ...progress } = campaign;
    expect(migrateCampaign(campaign)).toEqual({
        campaign: { ...progress, hasContent: true, recipientCount: 1 },
        content: { campaignId, message: prose, content, recipients },
    });
    expect(message.text).toBe("Exact text\n");
    expect(campaign.recipients).toEqual([subscriptionId]);
});

test("test_convert_and_verify_private_backup_without_sending_or_losing_records", async () => {
    const directory = await mkdtemp(join(tmpdir(), "zurich-mail-migration-"));
    const source = join(directory, "source");
    const destination = join(directory, "converted");
    try {
        const records = {
            posts: [],
            messages: [
                message,
                {
                    ...message,
                    _id: "test-email",
                    isTest: true,
                    to: "test@example.invalid",
                    outcome: "bounced",
                },
            ],
            campaigns: [campaign],
            subscriptions: [
                {
                    _id: subscriptionId,
                    _creationTime: 1,
                    email: message.to,
                    status: "subscribed",
                    token: "unchanged-token",
                    createdAt: 1,
                    updatedAt: 2,
                    deliveredAt: 150,
                    hasDeliveryFailure: true,
                },
            ],
            registrations: [
                {
                    _id: "registration-one",
                    _creationTime: 1,
                    eventId: "event-one",
                    email: message.to,
                    name: "Person",
                    status: "going",
                    createdAt: 1,
                    updatedAt: 1,
                },
            ],
        };
        for (const [table, rows] of Object.entries(records)) {
            await mkdir(join(source, table), { recursive: true });
            await writeFile(
                join(source, table, "documents.jsonl"),
                rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
            );
        }
        const manifest = await prepare(source, destination);
        expect(await verify(destination)).toEqual(manifest);
        expect(
            Object.fromEntries(
                Object.entries(manifest).map(([table, value]) => [table, value.rows]),
            ),
        ).toEqual({
            newsMentions: 0,
            subscriptions: 1,
            messages: 2,
            messageContents: 2,
            mailRecipients: 1,
            campaigns: 1,
            campaignContents: 1,
            communityTotals: 1,
            subscriptionDays: 1,
            eventCounts: 1,
            registrationDays: 1,
            mailDispatcher: 0,
        });
        const recipient = JSON.parse(
            await readFile(join(destination, "mailRecipients.jsonl"), "utf8"),
        );
        expect(recipient).toEqual({
            email: message.to,
            deliveredAt: 200,
            hasDeliveryFailure: true,
        });
        const subscription = JSON.parse(
            await readFile(join(destination, "subscriptions.jsonl"), "utf8"),
        );
        expect(subscription).toEqual({
            _id: subscriptionId,
            _creationTime: 1,
            email: message.to,
            status: "subscribed",
            token: "unchanged-token",
            createdAt: 1,
            updatedAt: 2,
        });
        expect(JSON.parse(await readFile(join(destination, "eventCounts.jsonl"), "utf8"))).toEqual({
            eventId: "event-one",
            total: 1,
            going: 1,
            waitlist: 0,
        });
        await expect(prepare(source, destination)).rejects.toThrow("EEXIST");

        // incomplete reports and incorrect counts cannot authorise partial conversions
        const report = join(destination, "manifest.json");
        await writeFile(report, JSON.stringify({}));
        await expect(verify(destination)).rejects.toThrow("migration manifest is incomplete");
        await writeFile(
            report,
            JSON.stringify({
                ...manifest,
                messages: { ...manifest.messages, rows: 3 },
            }),
        );
        await expect(verify(destination)).rejects.toThrow("migration row count differs: messages");
        await writeFile(report, JSON.stringify(manifest));

        // altered imports fail verification before any deployment command can use them
        await writeFile(join(destination, "messages.jsonl"), "{}\n");
        await expect(verify(destination)).rejects.toThrow("migration file changed: messages");
        expect(await readFile(join(source, "messages", "documents.jsonl"), "utf8")).toBe(
            records.messages.map((row) => JSON.stringify(row)).join("\n") + "\n",
        );
    } finally {
        await rm(directory, { recursive: true });
    }
});
