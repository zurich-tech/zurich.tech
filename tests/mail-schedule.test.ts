import { insertSubscription } from "../convex/mail/contacts";
import { insertRegistration } from "../convex/events/roster";
import {
    insertCampaign,
    updateCampaign,
    readCampaign,
    type Campaign,
} from "../convex/mail/campaign";
import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { convexTest, member, modules, schema, insertMessage, messageContent } from "./backend";
import { api, internal } from "../convex/_generated/api";
import { quotaDefaults, reserve } from "../convex/mail/sending";
import { sendingDate } from "../convex/mail/policy";
import type { TestConvex } from "convex-test";
import { select } from "../convex/mail/audiences";

const now = Date.parse("2026-10-14T10:00:00Z");
const names = ["MAIL_RECIPIENTS", "RESEND_WEBHOOK_SECRET", "SITE_URL", "CONVEX_SITE_URL"];
const fixtures: TestConvex<typeof schema>[] = [];
let environment: (string | undefined)[];

beforeEach(() => {
    environment = names.map((name) => process.env[name]);
    delete process.env.MAIL_RECIPIENTS;
    process.env.RESEND_WEBHOOK_SECRET = "local-only-no-provider";
    process.env.SITE_URL = "https://example.invalid";
    process.env.CONVEX_SITE_URL = "https://example.convex.site";
    setSystemTime(now);
});

afterEach(async () => {
    // prevent in-flight work from contacting a provider while draining its local scheduler
    process.env.MAIL_RECIPIENTS = "";
    for (const backend of fixtures) {
        let pending = true;
        while (pending) {
            await backend.run(async (ctx) => {
                const jobs = await ctx.db.system.query("_scheduled_functions").collect();
                for (const job of jobs)
                    if (job.state.kind === "pending") await ctx.scheduler.cancel(job._id);
            });
            await backend.finishInProgressScheduledFunctions();
            const jobs = await backend.run((ctx) =>
                ctx.db.system.query("_scheduled_functions").collect(),
            );
            expect(jobs.filter((job) => job.state.kind === "failed")).toEqual([]);
            pending = jobs.some((job) => ["pending", "inProgress"].includes(job.state.kind));
        }
    }
    fixtures.length = 0;

    // restore globals only after every fixture has stopped executing application code
    setSystemTime();
    names.forEach((name, index) => {
        if (environment[index] === undefined) delete process.env[name];
        else process.env[name] = environment[index];
    });
});

/** Prepare an isolated draft with no global daily approval or provider calls. */
async function setup() {
    const backend = convexTest(schema, modules);
    fixtures.push(backend);
    const records = await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Admin",
            searchText: "admin",
            visibility: "private",
        });
        const accountId = await ctx.db.insert("accounts", {
            authId: "schedule-admin",
            memberId,
            status: "active",
            isTeam: false,
            isAdmin: true,
            createdAt: 1,
            updatedAt: 1,
        });
        const policyId = await ctx.db.insert("mailPolicy", { isPaused: false });
        const quotaId = await ctx.db.insert("mailQuota", {
            ...quotaDefaults,
            date: sendingDate(now),
            ceiling: 100,
            hourlyLimit: 20,
            nextAt: 0,
        });
        const subscriptionId = await insertSubscription(ctx, {
            email: "original@example.invalid",
            status: "subscribed",
            token: "original",
            createdAt: 1,
            updatedAt: 1,
        });
        return { accountId, memberId, policyId, quotaId, subscriptionId };
    });
    const admin = backend.withIdentity({ subject: "schedule-admin" });
    const id = await admin.mutation(api.mail.campaigns.save, {
        subject: "Approved subject",
        message: "Frozen original content.",
    });
    const preview = await admin.query(api.mail.campaigns.preview, { id });
    const draft = (await backend.run((ctx) => readCampaign(ctx, id)))!;
    const args = {
        id,
        expectedUpdatedAt: draft.updatedAt,
        expectedRecipients: 1,
        expectedRecipientIds: preview.recipientIds,
        hourlyLimit: 10,
    };

    return { backend, admin, id, args, draft, ...records };
}

/** Execute the next pacing transaction without running any provider actions. */
async function advanceDispatcher(backend: TestConvex<typeof schema>, delay = 0) {
    const dispatcher = await backend.run(async (ctx) => {
        const dispatcher = await ctx.db.query("mailDispatcher").unique();
        if (!dispatcher?.jobId) throw new Error("dispatcher job is missing");
        const job = await ctx.db.system.get(dispatcher.jobId);
        if (!job) throw new Error("dispatcher job is missing");
        for (const pending of await ctx.db.system.query("_scheduled_functions").collect())
            if (pending.state.kind === "pending") await ctx.scheduler.cancel(pending._id);

        return { generation: dispatcher.generation, at: job.scheduledTime };
    });
    setSystemTime(dispatcher.at + delay);
    await backend.mutation(internal.mail.sending.dispatch, { generation: dispatcher.generation });
}

for (const delay of [0, 100, 500, 1000]) {
    test(`test_dispatch_once_per_recipient_with_${delay}ms_scheduler_delay`, async () => {
        const { backend, quotaId, policyId } = await setup();
        const count = 40;
        await backend.run(async (ctx) => {
            await ctx.db.patch(quotaId, { ceiling: 5000, hourlyLimit: 1600 });
            await ctx.db.patch(policyId, { approvedDate: sendingDate(now), approvedLimit: count });
            for (let index = 0; index < count; index++)
                await insertMessage(ctx, {
                    key: `paced-${index}`,
                    to: `${index}@example.invalid`,
                    subject: "Paced",
                    text: "Paced",
                    status: "queued",
                    isBulk: true,
                    category: "campaign",
                    attempts: 0,
                    nextAttemptAt: now,
                    createdAt: now,
                });
        });
        await backend.mutation(internal.mail.sending.dispatch, {});
        for (let index = 1; index < count; index++) {
            // repeated cron callbacks leave the same pending pacing job untouched
            const before = await backend.run((ctx) => ctx.db.query("mailDispatcher").unique());
            await backend.mutation(internal.mail.sending.dispatch, {});
            expect(await backend.run((ctx) => ctx.db.query("mailDispatcher").unique())).toEqual(
                before,
            );
            await advanceDispatcher(backend, delay);
        }
        const jobs = await backend.run((ctx) =>
            ctx.db.system.query("_scheduled_functions").collect(),
        );
        const deliveries = jobs.filter((job) => job.name === "mail/messages:deliver");
        expect(deliveries.length).toBe(count);
        expect(new Set(deliveries.map((job) => job.args[0].id)).size).toBe(count);
        expect(deliveries.map((job) => job.scheduledTime)).toEqual(
            Array.from({ length: count }, (_, index) => now + index * (2250 + delay)),
        );
        expect((await backend.run((ctx) => ctx.db.get(quotaId)))!.count).toBe(count);
    });
}

test("test_ignore_stale_dispatcher_callbacks_and_recover_cancelled_jobs", async () => {
    const { backend, quotaId, policyId } = await setup();
    await backend.run(async (ctx) => {
        await ctx.db.patch(policyId, { approvedDate: sendingDate(now), approvedLimit: 10 });
        await ctx.db.patch(quotaId, { nextAt: now + 1000 });
        await insertMessage(ctx, {
            key: "recovery",
            to: "recovery@example.invalid",
            subject: "Recovery",
            text: "Recovery",
            isBulk: true,
            category: "campaign",
            status: "queued",
            attempts: 0,
            nextAttemptAt: now,
            createdAt: now,
        });
    });
    await backend.mutation(internal.mail.sending.dispatch, {});
    const old = (await backend.run((ctx) => ctx.db.query("mailDispatcher").unique()))!;
    await backend.run((ctx) => ctx.scheduler.cancel(old.jobId!));
    await backend.mutation(internal.mail.sending.dispatch, {});
    const current = await backend.run((ctx) => ctx.db.query("mailDispatcher").unique());
    expect(current!.generation).toBe(old.generation + 1);
    await backend.mutation(internal.mail.sending.dispatch, { generation: old.generation });
    expect(await backend.run((ctx) => ctx.db.query("mailDispatcher").unique())).toEqual(current);
    expect((await backend.run((ctx) => ctx.db.get(quotaId)))!.count).toBe(0);
});

test("test_preserve_the_final_attempt_until_its_lease_expires", async () => {
    const { backend, policyId, quotaId } = await setup();
    const id = await backend.run(async (ctx) => {
        await ctx.db.patch(policyId, { approvedDate: sendingDate(now), approvedLimit: 10 });
        await ctx.db.patch(quotaId, { hourlyLimit: 3600 });
        return insertMessage(ctx, {
            key: "last-attempt",
            to: "last@example.invalid",
            subject: "Retry",
            text: "Retry",
            status: "queued",
            isBulk: true,
            category: "campaign",
            attempts: 4,
            nextAttemptAt: now,
            createdAt: now,
        });
    });
    await backend.mutation(internal.mail.sending.dispatch, {});
    await advanceDispatcher(backend);
    expect(await backend.run((ctx) => ctx.db.get(id))).toMatchObject({
        status: "queued",
        attempts: 5,
        nextAttemptAt: now + 300000,
    });
    expect((await backend.run((ctx) => ctx.db.get(quotaId)))!.count).toBe(1);

    // recovery may fail an abandoned final attempt only after its full lease
    setSystemTime(now + 300000);
    await backend.run(async (ctx) => {
        const dispatcher = (await ctx.db.query("mailDispatcher").unique())!;
        await ctx.scheduler.cancel(dispatcher.jobId!);
    });
    await backend.mutation(internal.mail.sending.dispatch, {});
    expect(await backend.run((ctx) => ctx.db.get(id))).toMatchObject({
        status: "failed",
        attempts: 5,
    });
});

test("test_approve_now_without_global_approval_or_policy_changes", async () => {
    const fixture = await setup();
    const { backend, admin, id, args, accountId, subscriptionId } = fixture;
    const policy = await backend.run((ctx) => ctx.db.get(fixture.policyId));
    const quota = await backend.run((ctx) => ctx.db.get(fixture.quotaId));
    await admin.mutation(api.mail.campaigns.queue, args);
    expect(await backend.run((ctx) => readCampaign(ctx, id))).toMatchObject({
        status: "queued",
        recipients: [subscriptionId],
        attempts: 0,
        attemptLimit: 1,
        approval: {
            date: "2026-10-14",
            limit: 1,
            hourlyLimit: 10,
            approvedAt: now,
            approvedBy: accountId,
        },
    });
    expect(await backend.run((ctx) => ctx.db.get(fixture.policyId))).toEqual(policy);
    expect(await backend.run((ctx) => ctx.db.get(fixture.quotaId))).toEqual(quota);
    await backend.mutation(internal.mail.campaigns.batch, { id });
    const messages = await backend.run((ctx) => ctx.db.query("messages").collect());
    expect(messages).toHaveLength(1);
    expect(await backend.mutation(internal.mail.messages.claim, { id: messages[0]._id })).toBe(
        true,
    );
    expect(await backend.run((ctx) => readCampaign(ctx, id))).toMatchObject({
        attempts: 1,
        nextAttemptAt: now + 360000,
    });
});

test("test_freeze_scheduled_membership_and_content_at_approval", async () => {
    const { backend, admin, id, args, subscriptionId } = await setup();
    const scheduledAt = now + 60000;
    await admin.mutation(api.mail.campaigns.queue, { ...args, scheduledAt });
    const approved = (await backend.run((ctx) => readCampaign(ctx, id)))!;
    expect(approved).toMatchObject({
        status: "scheduled",
        recipients: [subscriptionId],
        attemptLimit: 1,
    });
    expect(approved.cursor).toBeUndefined();
    await backend.run((ctx) =>
        insertSubscription(ctx, {
            email: "late@example.invalid",
            status: "subscribed",
            token: "late",
            createdAt: now,
            updatedAt: now,
        }),
    );
    await expect(
        admin.mutation(api.mail.campaigns.save, {
            id,
            subject: "Replacement",
            message: "Replacement",
        }),
    ).rejects.toThrow("Only written drafts in the same audience scope can be edited.");
    await admin.mutation(api.mail.campaigns.pause, { id, isPaused: true });
    await admin.mutation(api.mail.campaigns.pause, { id, isPaused: false });
    expect(await backend.run((ctx) => readCampaign(ctx, id))).toMatchObject({
        status: "scheduled",
        approval: approved.approval,
        content: approved.content,
    });
    await backend.mutation(internal.mail.campaigns.tick, {});
    expect(await backend.run((ctx) => ctx.db.query("messages").collect())).toEqual([]);
    setSystemTime(scheduledAt);
    await backend.mutation(internal.mail.campaigns.tick, {});
    await backend.mutation(internal.mail.campaigns.batch, { id });
    const messages = await backend.run((ctx) => ctx.db.query("messages").collect());
    expect(messages.map((message) => message.subscriptionId)).toEqual([subscriptionId]);
    expect((await backend.run((ctx) => messageContent(ctx, messages[0]._id))).text).toContain(
        "Frozen original content.",
    );
    expect(await backend.run((ctx) => readCampaign(ctx, id))).toMatchObject({
        approval: approved.approval,
        recipients: [subscriptionId],
    });
});

test("test_reject_equal_count_replacement_and_missing_reviewed_identities", async () => {
    const { backend, admin, id, args, subscriptionId, draft } = await setup();
    expect(args.expectedRecipientIds).toEqual([subscriptionId]);
    await expect(
        admin.mutation(api.mail.campaigns.queue, { ...args, expectedRecipientIds: undefined }),
    ).rejects.toThrow("Recipients changed. Preview the campaign again.");
    await backend.run(async (ctx) => {
        await ctx.db.patch(subscriptionId, { status: "unsubscribed" });
        await insertSubscription(ctx, {
            email: "replacement@example.invalid",
            status: "subscribed",
            token: "replacement",
            createdAt: now,
            updatedAt: now,
        });
    });
    await expect(admin.mutation(api.mail.campaigns.queue, args)).rejects.toThrow(
        "Recipients changed. Preview the campaign again.",
    );
    expect(await backend.run((ctx) => readCampaign(ctx, id))).toEqual(draft);
    expect(await backend.run((ctx) => ctx.db.query("messages").collect())).toEqual([]);
});

test("test_reject_invalid_rates_stale_previews_and_past_schedule_without_mutation", async () => {
    const { backend, admin, id, args, draft } = await setup();
    for (const hourlyLimit of [undefined, 0, -1, 1.5, 21])
        await expect(
            admin.mutation(api.mail.campaigns.queue, { ...args, hourlyLimit }),
        ).rejects.toThrow("Choose an hourly limit from 1 to 20.");
    await expect(
        admin.mutation(api.mail.campaigns.queue, { ...args, expectedUpdatedAt: 0 }),
    ).rejects.toThrow("Campaign changed. Preview it again.");
    await expect(
        admin.mutation(api.mail.campaigns.queue, { ...args, expectedRecipients: 2 }),
    ).rejects.toThrow("Recipient count changed. Preview it again.");
    await expect(
        admin.mutation(api.mail.campaigns.queue, { ...args, scheduledAt: now }),
    ).rejects.toThrow("Choose a future send time.");
    expect(await backend.run((ctx) => readCampaign(ctx, id))).toEqual(draft);
});

test("test_reject_non_admin_subscriber_approval", async () => {
    const { backend, admin, args, accountId } = await setup();
    await backend.run((ctx) =>
        ctx.db.patch(accountId, { isAdmin: false, isTeam: true, isMailSender: true }),
    );
    await expect(admin.mutation(api.mail.campaigns.queue, args)).rejects.toThrow(
        "Admin access is required.",
    );
});

test("test_allow_untouched_zero_limit_draft_but_never_reapprove_legacy_work", async () => {
    const { backend, admin, id, args } = await setup();
    const legacy: Partial<Campaign>[] = [
        { attempts: 1 },
        { attemptLimit: 1 },
        { recipients: [] },
        { reviewedBatch: { messages: [], source: "legacy" } },
    ];
    for (const fields of legacy) {
        await backend.run((ctx) =>
            updateCampaign(ctx, id, {
                attempts: undefined,
                attemptLimit: undefined,
                recipients: undefined,
                reviewedBatch: undefined,
                ...fields,
            }),
        );
        await expect(admin.mutation(api.mail.campaigns.queue, args)).rejects.toThrow(
            "This campaign has already been released. Create a new draft.",
        );
    }
    await backend.run((ctx) =>
        updateCampaign(ctx, id, {
            attempts: 0,
            attemptLimit: 0,
            recipients: undefined,
            reviewedBatch: undefined,
        }),
    );
    await admin.mutation(api.mail.campaigns.queue, args);
    await expect(admin.mutation(api.mail.campaigns.queue, args)).rejects.toThrow(
        "This campaign has already been released. Create a new draft.",
    );
});

test("test_expire_at_zurich_midnight_even_when_global_delivery_is_paused", async () => {
    const { backend, admin, id, args, policyId } = await setup();
    await admin.mutation(api.mail.campaigns.queue, { ...args, scheduledAt: now + 60000 });
    await backend.run((ctx) => ctx.db.patch(policyId, { isPaused: true }));
    setSystemTime(Date.parse("2026-10-14T22:00:00Z"));
    await backend.mutation(internal.mail.campaigns.tick, {});
    expect(await backend.run((ctx) => readCampaign(ctx, id))).toMatchObject({
        status: "paused",
        pauseReason:
            "Campaign approval expired at Zurich midnight. Review unsent recipients in a new campaign.",
    });
    await expect(admin.mutation(api.mail.campaigns.pause, { id, isPaused: false })).rejects.toThrow(
        "Campaign approval expired. Review unsent recipients in a new campaign.",
    );
});

test("test_never_borrow_global_approval_to_override_campaign_date_or_cap", async () => {
    const { backend, admin, id, args, policyId } = await setup();
    await admin.mutation(api.mail.campaigns.queue, args);
    await backend.run((ctx) =>
        ctx.db.patch(policyId, { approvedDate: sendingDate(now), approvedLimit: 100 }),
    );
    const campaign = (await backend.run((ctx) => readCampaign(ctx, id)))!;
    for (const changed of [
        { ...campaign, attempts: 1 },
        { ...campaign, approval: { ...campaign.approval!, date: "2026-10-13" } },
        { ...campaign, approval: { ...campaign.approval!, date: "2026-10-15" } },
        { ...campaign, scheduledAt: now + 1 },
    ])
        expect(await backend.run((ctx) => reserve(ctx, now, changed))).toBe(false);
    expect(await backend.run((ctx) => reserve(ctx, now, campaign))).toBe(true);
});

test("test_preserve_campaign_pacing_across_pause_and_global_quota_limits", async () => {
    const { backend, admin, id, args, quotaId } = await setup();
    await admin.mutation(api.mail.campaigns.queue, args);
    const campaign = (await backend.run((ctx) => readCampaign(ctx, id)))!;
    expect(await backend.run((ctx) => reserve(ctx, now, campaign))).toBe(true);
    await admin.mutation(api.mail.campaigns.pause, { id, isPaused: true });
    await admin.mutation(api.mail.campaigns.pause, { id, isPaused: false });
    const resumed = (await backend.run((ctx) => readCampaign(ctx, id)))!;
    expect(resumed.nextAttemptAt).toBe(now + 360000);
    expect(await backend.run((ctx) => reserve(ctx, now + 180000, resumed))).toEqual({
        retryAt: now + 360000,
    });
    expect(await backend.run((ctx) => reserve(ctx, now + 360000, resumed))).toBe(true);
    await backend.run((ctx) => ctx.db.patch(quotaId, { count: 100 }));
    expect(await backend.run((ctx) => reserve(ctx, now + 720000, resumed))).toBe(false);
});

test("test_create_fresh_announcements_without_legacy_attempt_limit", async () => {
    const { backend, admin, memberId } = await setup();
    const eventId = await backend.run((ctx) =>
        ctx.db.insert("events", {
            ownerId: memberId,
            title: "Event",
            slug: "schedule-event",
            format: "talk",
            description: "Talk",
            topics: [],
            startsAt: now + 86400000,
            registration: { kind: "none" },
            status: "scheduled",
            createdAt: now,
            updatedAt: now,
        }),
    );
    const id = await admin.mutation(api.mail.campaigns.announcement, {
        eventId,
        audience: { kind: "subscribers", excludeEventId: eventId },
    });
    const campaign = (await backend.run((ctx) => readCampaign(ctx, id)))!;
    expect(campaign.attemptLimit).toBeUndefined();
    const preview = await admin.query(api.mail.campaigns.preview, { id });
    await admin.mutation(api.mail.campaigns.queue, {
        id,
        expectedUpdatedAt: campaign.updatedAt,
        expectedRecipients: 1,
        expectedRecipientIds: preview.recipientIds,
        hourlyLimit: 10,
    });
    expect(await backend.run((ctx) => readCampaign(ctx, id))).toMatchObject({
        attemptLimit: 1,
        attempts: 0,
        status: "queued",
    });
});

test("test_respect_delivery_stops_and_later_opt_outs_after_approval", async () => {
    const { backend, admin, id, args, policyId, quotaId, subscriptionId } = await setup();
    await admin.mutation(api.mail.campaigns.queue, args);
    await backend.mutation(internal.mail.campaigns.batch, { id });
    const message = (await backend.run((ctx) => ctx.db.query("messages").unique()))!;
    await backend.run((ctx) => ctx.db.patch(policyId, { isPaused: true }));
    expect(await backend.mutation(internal.mail.messages.claim, { id: message._id })).toBe(false);
    await backend.run((ctx) => ctx.db.patch(policyId, { isPaused: false }));
    process.env.MAIL_RECIPIENTS = "original@example.invalid";
    expect(await backend.mutation(internal.mail.messages.claim, { id: message._id })).toBe(false);
    delete process.env.MAIL_RECIPIENTS;
    delete process.env.RESEND_WEBHOOK_SECRET;
    expect(await backend.mutation(internal.mail.messages.claim, { id: message._id })).toBe(false);
    process.env.RESEND_WEBHOOK_SECRET = "local-only-no-provider";
    await backend.run((ctx) => ctx.db.patch(subscriptionId, { status: "unsubscribed" }));
    const quota = await backend.run((ctx) => ctx.db.get(quotaId));

    // deliver checks consent before the quota lease; claim alone does not decide eligibility
    await backend.action(internal.mail.messages.deliver, { id: message._id });
    expect(await backend.run((ctx) => ctx.db.get(message._id))).toMatchObject({
        status: "skipped",
        attempts: 0,
    });
    expect(await backend.run((ctx) => readCampaign(ctx, id))).toMatchObject({ attempts: 0 });
    expect(await backend.run((ctx) => ctx.db.get(quotaId))).toEqual(quota);
});

test("test_dispatch_campaign_approval_without_global_approval_at_its_own_rate", async () => {
    const { backend, admin, id, args, quotaId, policyId } = await setup();
    await backend.run(async (ctx) => {
        await ctx.db.patch(quotaId, { hourlyLimit: 3600 });
        for (const name of ["second", "third"])
            await insertSubscription(ctx, {
                email: `${name}@example.invalid`,
                status: "subscribed",
                token: name,
                createdAt: now,
                updatedAt: now,
            });
    });
    const preview = await admin.query(api.mail.campaigns.preview, { id });
    await admin.mutation(api.mail.campaigns.queue, {
        ...args,
        expectedRecipients: 3,
        expectedRecipientIds: preview.recipientIds,
        hourlyLimit: 120,
    });
    const records = await backend.run(async (ctx) => {
        await ctx.db.patch(id, { nextAttemptAt: now + 10000 });
        const legacyId = await insertCampaign(ctx, {
            subject: "Legacy",
            message: "Unapproved",
            category: "campaign",
            status: "queued",
            attemptLimit: 10,
            attempts: 0,
            createdAt: 1,
            updatedAt: 1,
        });
        const messages = [];
        for (const [index, campaignId] of [legacyId, id, id, id].entries()) {
            messages.push(
                await insertMessage(ctx, {
                    key: `dispatch-${index}`,
                    to: `dispatch-${index}@example.invalid`,
                    subject: "Test",
                    text: "Test",
                    status: "queued",
                    isBulk: true,
                    category: "campaign",
                    campaignId,
                    nextAttemptAt: now - 1000 + index,
                    attempts: 0,
                    createdAt: 1,
                }),
            );
        }

        return messages;
    });
    const before = await backend.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect(),
    );
    const policy = await backend.run((ctx) => ctx.db.get(policyId));
    expect(policy?.approvedDate).toBeUndefined();
    expect(policy?.approvedLimit).toBeUndefined();
    await backend.mutation(internal.mail.sending.dispatch, {});
    const after = await backend.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    const scheduled = after.filter((job) => !before.some((old) => old._id === job._id));

    // reserve no attempts before the campaign's next eligible time
    expect(
        scheduled.map((job) => ({ name: job.name, args: job.args, at: job.scheduledTime })),
    ).toEqual([{ name: "mail/sending:dispatch", args: [{ generation: 1 }], at: now + 10000 }]);
    await advanceDispatcher(backend);
    expect(await backend.run((ctx) => ctx.db.get(records[1]))).toMatchObject({ attempts: 1 });
    await advanceDispatcher(backend);
    await advanceDispatcher(backend);
    expect(await backend.run((ctx) => ctx.db.get(records[2]))).toMatchObject({ attempts: 1 });
    expect(await backend.run((ctx) => ctx.db.get(records[0]))).toMatchObject({
        nextAttemptAt: now - 1000,
        attempts: 0,
    });
    expect(await backend.run((ctx) => ctx.db.get(records[3]))).toMatchObject({
        nextAttemptAt: now - 997,
        attempts: 0,
    });
    expect(await backend.run((ctx) => ctx.db.get(policyId))).toEqual(policy);
});

test("test_keep_organiser_transactional_queue_without_subscriber_approval", async () => {
    const { backend, admin, memberId, accountId } = await setup();
    const eventId = await backend.run(async (ctx) => {
        const eventId = await ctx.db.insert("events", {
            ownerId: memberId,
            title: "Event",
            slug: "transactional-event",
            format: "talk",
            description: "Talk",
            topics: [],
            startsAt: now + 86400000,
            registration: { kind: "none" },
            status: "scheduled",
            createdAt: now,
            updatedAt: now,
        });
        await insertRegistration(ctx, {
            eventId,
            email: "attendee@example.invalid",
            name: "Attendee",
            status: "going",
            token: "attendee",
            createdAt: now,
            updatedAt: now,
        });
        await ctx.db.insert("accessGrants", {
            accountId,
            role: "organiser",
            scope: { kind: "event", id: eventId },
            updatedAt: now,
        });
        await ctx.db.patch(accountId, { isAdmin: false, isMailSender: true });

        return eventId;
    });
    const id = await admin.mutation(api.mail.campaigns.save, {
        subject: "Event update",
        message: "Attendee notice",
        audience: { kind: "registrations", eventId, status: "active" },
    });
    const preview = await admin.query(api.mail.campaigns.preview, { id });
    expect(preview.recipientIds).toBeUndefined();
    const campaign = (await backend.run((ctx) => readCampaign(ctx, id)))!;
    const args = { id, expectedUpdatedAt: campaign.updatedAt, expectedRecipients: 1 };
    await expect(
        admin.mutation(api.mail.campaigns.queue, { ...args, hourlyLimit: 10 }),
    ).rejects.toThrow("Hourly limits apply only to subscriber campaigns.");
    await admin.mutation(api.mail.campaigns.queue, args);
    const queued = (await backend.run((ctx) => readCampaign(ctx, id)))!;
    expect(queued.status).toBe("queued");
    expect(queued.approval).toBeUndefined();
    expect(queued.attemptLimit).toBeUndefined();
    await backend.mutation(internal.mail.campaigns.batch, { id });
    const messages = await backend.run((ctx) => ctx.db.query("messages").collect());
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ isBulk: false, to: "attendee@example.invalid" });
});

/** Prepare a real announcement against a future published event. */
async function announcement() {
    const fixture = await setup();
    const eventId = await fixture.backend.run((ctx) =>
        ctx.db.insert("events", {
            ownerId: fixture.memberId,
            title: "Announcement",
            slug: "announcement",
            format: "talk",
            description: "Talk",
            topics: [],
            startsAt: now + 3 * 86400000,
            registration: { kind: "none" },
            status: "scheduled",
            createdAt: now,
            updatedAt: now,
        }),
    );
    const audience = { kind: "subscribers" as const, excludeEventId: eventId };
    const id = await fixture.admin.mutation(api.mail.campaigns.announcement, { eventId, audience });

    return { ...fixture, id, eventId, audience };
}

test("test_release_cancelled_unattempted_schedule_for_new_announcement", async () => {
    const { backend, admin, id, eventId, audience, subscriptionId } = await announcement();
    const draft = (await backend.run((ctx) => readCampaign(ctx, id)))!;
    const preview = await admin.query(api.mail.campaigns.preview, { id });
    await admin.mutation(api.mail.campaigns.queue, {
        id,
        expectedUpdatedAt: draft.updatedAt,
        expectedRecipients: 1,
        expectedRecipientIds: preview.recipientIds,
        hourlyLimit: 10,
        scheduledAt: now + 60000,
    });
    expect((await backend.run((ctx) => select(ctx, audience, "announcement"))).recipients).toEqual(
        [],
    );
    await admin.mutation(api.mail.campaigns.cancel, { id });
    const replacement = await admin.mutation(api.mail.campaigns.announcement, {
        eventId,
        audience,
    });
    const reviewed = await admin.query(api.mail.campaigns.preview, { id: replacement });
    expect(reviewed.recipientIds).toEqual([subscriptionId]);
    const replacementDraft = (await backend.run((ctx) => ctx.db.get(replacement)))!;
    await admin.mutation(api.mail.campaigns.queue, {
        id: replacement,
        expectedUpdatedAt: replacementDraft.updatedAt,
        expectedRecipients: 1,
        expectedRecipientIds: reviewed.recipientIds,
        hourlyLimit: 10,
        scheduledAt: now + 120000,
    });
    expect(await backend.run((ctx) => readCampaign(ctx, replacement))).toMatchObject({
        status: "scheduled",
        recipients: [subscriptionId],
    });
    expect(await backend.run((ctx) => ctx.db.query("messages").collect())).toEqual([]);
});

for (const ending of ["cancel", "expire"] as const) {
    test(`test_${ending}_reserves_only_real_attempted_announcement_recipients`, async () => {
        const { backend, admin, id, audience, subscriptionId } = await announcement();
        const untouched = await backend.run((ctx) =>
            insertSubscription(ctx, {
                email: "untouched@example.invalid",
                status: "subscribed",
                token: "untouched",
                createdAt: now,
                updatedAt: now,
            }),
        );
        const draft = (await backend.run((ctx) => readCampaign(ctx, id)))!;
        const preview = await admin.query(api.mail.campaigns.preview, { id });
        await admin.mutation(api.mail.campaigns.queue, {
            id,
            expectedUpdatedAt: draft.updatedAt,
            expectedRecipients: 2,
            expectedRecipientIds: preview.recipientIds,
            hourlyLimit: 10,
        });
        await backend.mutation(internal.mail.campaigns.batch, { id });
        await backend.run(async (ctx) => {
            const messages = await ctx.db.query("messages").collect();
            const attempted = messages.find(
                (message) => message.subscriptionId === subscriptionId,
            )!;
            await ctx.db.patch(attempted._id, { attempts: 1, firstAttemptAt: now });
            await ctx.db.patch(id, { attempts: 1 });
            await insertMessage(ctx, {
                key: "self-test",
                to: "untouched@example.invalid",
                subject: "Test",
                text: "Test",
                status: "accepted",
                isBulk: true,
                isTest: true,
                campaignId: id,
                subscriptionId: untouched,
                category: "announcement",
                nextAttemptAt: now,
                attempts: 1,
                createdAt: now,
            });
        });
        if (ending === "cancel") await admin.mutation(api.mail.campaigns.cancel, { id });
        else {
            setSystemTime(Date.parse("2026-10-14T22:00:00Z"));
            await backend.mutation(internal.mail.campaigns.tick, {});
        }
        expect(
            (await backend.run((ctx) => select(ctx, audience, "announcement"))).recipients,
        ).toEqual([untouched]);

        // legacy cancellation retains every reservation despite absent delivery attempts
        await backend.run((ctx) => ctx.db.patch(id, { approval: undefined, status: "cancelled" }));
        expect(
            (await backend.run((ctx) => select(ctx, audience, "announcement"))).recipients,
        ).toEqual([]);
    });
}

for (const scenario of [
    {
        name: "dispatch_fast_campaign_despite_one_hundred_older_slow_messages",
        hourly: 3600,
        campaigns: [
            [100, 1],
            [1, 3600],
        ],
        order: [0, 100],
    },
    {
        name: "fill_unique_shared_slots_with_mixed_campaign_rates",
        hourly: 360,
        campaigns: [
            [3, 120],
            [6, 360],
        ],
        order: [0, 3, 4, 1, 5, 6],
    },
] as const) {
    test(`test_${scenario.name}`, async () => {
        const { backend, accountId, quotaId } = await setup();
        const records = await backend.run(async (ctx) => {
            await ctx.db.patch(quotaId, { ceiling: 500, hourlyLimit: scenario.hourly });
            const messages = [];
            for (const [group, [count, hourlyLimit]] of scenario.campaigns.entries()) {
                const name = `campaign-${group}`;
                const campaignId = await insertCampaign(ctx, {
                    subject: name,
                    message: name,
                    category: "campaign",
                    status: "queued",
                    scheduledAt: now,
                    approval: {
                        date: sendingDate(now),
                        limit: count,
                        hourlyLimit,
                        approvedAt: now,
                        approvedBy: accountId,
                    },
                    attemptLimit: count,
                    attempts: 0,
                    createdAt: now,
                    updatedAt: now,
                });
                for (let index = 0; index < count; index++)
                    messages.push(
                        await insertMessage(ctx, {
                            key: `${name}-${index}`,
                            to: `${name}-${index}@example.invalid`,
                            subject: name,
                            text: name,
                            campaignId,
                            category: "campaign",
                            status: "queued",
                            isBulk: true,
                            attempts: 0,
                            nextAttemptAt: now - (group === 0 ? 1000 : 100) + index,
                            createdAt: now,
                        }),
                    );
            }

            return messages;
        });
        await backend.mutation(internal.mail.sending.dispatch, {});
        for (let index = 1; index < scenario.order.length; index++)
            await advanceDispatcher(backend);
        const jobs = await backend.run((ctx) =>
            ctx.db.system.query("_scheduled_functions").collect(),
        );
        const scheduled = jobs
            .filter((job) => job.name === "mail/messages:deliver")
            .sort((left, right) => left.scheduledTime - right.scheduledTime);

        // preserve each campaign's pace while filling the shared sender's available slots
        expect(
            scheduled.map((job) => ({ name: job.name, args: job.args, at: job.scheduledTime })),
        ).toEqual(
            scenario.order.map((record, index) => ({
                name: "mail/messages:deliver",
                args: [{ id: records[record], attempt: 1 }],
                at: now + (index * 3600000) / scenario.hourly,
            })),
        );
        expect(new Set(scheduled.map((job) => job.scheduledTime)).size).toBe(scenario.order.length);
    });
}

test("test_duplicate_approved_written_content_without_approval_or_delivery_history", async () => {
    const { backend, admin, id, args, accountId } = await setup();
    await admin.mutation(api.mail.campaigns.queue, { ...args, scheduledAt: now + 60000 });
    await backend.run((ctx) =>
        ctx.db.patch(id, { attempts: 1, nextAttemptAt: now + 360000, accepted: 1 }),
    );
    const copyId = await admin.mutation(api.mail.campaigns.duplicate, { id });
    const copy = (await backend.run((ctx) => readCampaign(ctx, copyId)))!;
    const { _id, _creationTime, ...fields } = copy;
    expect(_id).not.toBe(id);
    expect(fields).toEqual({
        subject: "Approved subject",
        message: "Frozen original content.",
        audience: { kind: "subscribers" },
        category: "campaign",
        authorId: accountId,
        status: "draft",
        createdAt: now,
        updatedAt: now,
    });
    for (const changes of [
        { category: "announcement" as const },
        { category: "campaign" as const, key: "automatic" },
        { key: undefined, approval: undefined, attemptLimit: 0 },
    ]) {
        await backend.run((ctx) => ctx.db.patch(id, changes));
        await expect(admin.mutation(api.mail.campaigns.duplicate, { id })).rejects.toThrow(
            "Automatic campaigns are created by their product action.",
        );
    }
});
