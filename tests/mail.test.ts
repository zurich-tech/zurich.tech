import { convexTest, schema, modules, member } from "./backend";
import { afterEach, beforeEach, expect, test, setSystemTime } from "bun:test";
import { httpRouter } from "convex/server";
import { Webhook } from "svix";
import { api, internal } from "../convex/_generated/api";
import { quotaDefaults, reserve } from "../convex/mail/sending";
import { updateMessage } from "../convex/mail/progress";
import { enqueue } from "../convex/mail/messages";
import { unsubscribeHeaders } from "../convex/mail/provider";
import { receive, unsubscribe } from "../convex/mail/webhooks";
import { sendingDate } from "../convex/mail/policy";
import { rank } from "../convex/mail/audiences";

const http = httpRouter();
http.route({ path: "/mail/webhook", method: "POST", handler: receive });
http.route({ path: "/mail/unsubscribe", method: "POST", handler: unsubscribe });
http.route({ path: "/mail/unsubscribe", method: "GET", handler: unsubscribe });
const mailModules = {
    ...modules,
    "../convex/http.ts": async () => ({ default: http }),
};
const secret = `whsec_${btoa("only-a-local-test-secret-for-signatures")}`;
const names = [
    "MAIL_RECIPIENTS",
    "RESEND_WEBHOOK_SECRET",
    "RESEND_API_KEY",
    "MAIL_FROM",
    "SITE_URL",
    "CONVEX_SITE_URL",
];
let environment: (string | undefined)[];
beforeEach(() => {
    environment = names.map((name) => process.env[name]);
    delete process.env.MAIL_RECIPIENTS;
    Object.assign(process.env, {
        RESEND_WEBHOOK_SECRET: secret,
        RESEND_API_KEY: "test-do-not-send",
        MAIL_FROM: "test@example.invalid",
        SITE_URL: "https://example.invalid",
        CONVEX_SITE_URL: "https://example.convex.site",
    });
});
afterEach(() => {
    setSystemTime();
    names.forEach((name, index) => {
        if (environment[index] === undefined) delete process.env[name];
        else process.env[name] = environment[index];
    });
});

/** Seed only local database records; these tests never contact the mail provider. */
async function setup() {
    const backend = convexTest(schema, mailModules);
    const ids = await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Test",
            searchText: "test",
            visibility: "private",
        });
        await ctx.db.insert("accounts", {
            authId: "admin",
            memberId,
            status: "active",
            isTeam: false,
            isAdmin: true,
            createdAt: 1,
            updatedAt: 1,
        });
        const settingsId = await ctx.db.insert("mailQuota", quotaDefaults);
        await ctx.db.insert("mailPolicy", {
            isPaused: false,
            approvedDate: sendingDate(Date.now()),
            approvedLimit: 500,
        });
        const subscriptionId = await ctx.db.insert("subscriptions", {
            email: "test@example.invalid",
            status: "subscribed",
            token: "private-unsubscribe-token",
            createdAt: 1,
            updatedAt: 1,
        });
        return { settingsId, subscriptionId, memberId };
    });
    return { backend, admin: backend.withIdentity({ subject: "admin" }), ...ids };
}

/** Sign exactly the bytes the endpoint will receive. */
function signed(
    type: string,
    providerId: string,
    eventId: string = crypto.randomUUID(),
    date = new Date(),
) {
    const body = JSON.stringify({
        type: `email.${type}`,
        data: {
            email_id: providerId,
            ...(type === "bounced" ? { bounce: { type: "Permanent" } } : {}),
        },
    });
    return {
        method: "POST",
        body,
        headers: {
            "svix-id": eventId,
            "svix-timestamp": String(Math.floor(date.getTime() / 1000)),
            "svix-signature": new Webhook(secret).sign(eventId, date, body),
        },
    };
}

test("bulk reservations share pacing, daily limits and a lock that settings cannot remove", async () => {
    setSystemTime(new Date("2026-09-14T06:00:00Z"));
    const { backend, admin, settingsId } = await setup();
    const now = Date.UTC(2026, 8, 14, 6);

    // pace attempts across the sending hours of the initial ceiling
    expect(await backend.run((ctx) => reserve(ctx, now))).toBe(true);
    expect(await backend.run((ctx) => reserve(ctx, now + 1))).toBe(false);
    expect(await backend.run((ctx) => reserve(ctx, now + 96000))).toBe(true);

    // stop at the daily ceiling until the next sending day
    await backend.run((ctx) => ctx.db.patch(settingsId, { count: 500 }));
    expect(await backend.run((ctx) => reserve(ctx, now + 3600000))).toBe(false);
    expect(await backend.run((ctx) => reserve(ctx, now + 10 * 86400000))).toBe(false);

    // enforce the recipient lock independently of settings
    process.env.MAIL_RECIPIENTS = "test@example.invalid";
    expect(await backend.run((ctx) => reserve(ctx, now + 11 * 86400000))).toBe(false);
    await expect(admin.mutation(api.mail.sending.configure, { isPaused: false })).rejects.toThrow(
        "lock",
    );
    await expect(
        backend.mutation(api.mail.sending.configure, { isPaused: false }),
    ).rejects.toThrow();
});

// Each release is absolute, date scoped and independent of pause state.
test("test_approve_batches_without_resuming_or_replenishing_usage", async () => {
    setSystemTime(new Date("2026-09-28T06:00:00Z"));
    const { backend, admin, settingsId } = await setup();
    await admin.mutation(api.mail.sending.configure, { isPaused: true });
    await admin.mutation(api.mail.sending.approve, { limit: 100, ceiling: 500 });
    expect(await backend.run((ctx) => reserve(ctx, Date.now()))).toBe(false);
    await admin.mutation(api.mail.sending.configure, { isPaused: false });
    expect(await backend.run((ctx) => reserve(ctx, Date.now()))).toBe(true);

    // stop at the checkpoint and release only the remaining daily allowance
    await backend.run((ctx) => ctx.db.patch(settingsId, { count: 100, nextAt: 0 }));
    expect(await backend.run((ctx) => reserve(ctx, Date.now()))).toBe(false);
    await admin.mutation(api.mail.sending.approve, { limit: 500, ceiling: 500 });
    expect((await admin.query(api.mail.sending.current, {})).count).toBe(100);
    expect(await backend.run((ctx) => reserve(ctx, Date.now()))).toBe(true);

    // Zurich midnight revokes yesterday's approval, without automatic growth
    setSystemTime(new Date("2026-09-28T22:00:00Z"));
    expect(await backend.run((ctx) => reserve(ctx, Date.now()))).toBe(false);
    expect((await admin.query(api.mail.sending.current, {})).limits.daily).toBe(500);
    await admin.mutation(api.mail.sending.approve, { limit: 1000, ceiling: 1000 });
    expect(await backend.run((ctx) => reserve(ctx, Date.now()))).toBe(true);
    await expect(
        backend.mutation(api.mail.sending.approve, { limit: 1000, ceiling: 1000 }),
    ).rejects.toThrow();
    await expect(
        admin.mutation(api.mail.sending.approve, { limit: 0, ceiling: 1000 }),
    ).rejects.toThrow("The approved total cannot be lower than today's used attempts.");
    await expect(
        admin.mutation(api.mail.sending.approve, { limit: 1001, ceiling: 1000 }),
    ).rejects.toThrow("Choose whole-number limits");
});

test("test_require_approval_and_preserve_pacing_and_health", async () => {
    // an enabled legacy policy without an approval must not release bulk mail
    setSystemTime(new Date("2026-09-28T06:00:00Z"));
    const { backend, admin, settingsId } = await setup();
    await backend.run(async (ctx) => {
        const policy = (await ctx.db.query("mailPolicy").unique())!;
        await ctx.db.patch(policy._id, { approvedDate: undefined, approvedLimit: undefined });
        await ctx.db.patch(settingsId, {
            date: sendingDate(Date.now()),
            count: 20,
            nextAt: Date.now() + 60000,
            accepted: 18,
            bounced: 1,
            complained: 1,
        });
    });
    expect(await backend.run((ctx) => reserve(ctx, Date.now() + 60000))).toBe(false);
    expect((await admin.query(api.mail.sending.current, {})).remaining).toBe(0);

    // approval changes only the pace, retaining health, usage and the next send time
    const before = (await backend.run((ctx) => ctx.db.get(settingsId)))!;
    await admin.mutation(api.mail.sending.approve, { limit: 100, ceiling: 1000 });
    expect(await backend.run((ctx) => ctx.db.get(settingsId))).toEqual({
        ...before,
        ceiling: 1000,
    });
    expect(await backend.run((ctx) => reserve(ctx, Date.now()))).toBe(false);
    expect((await admin.query(api.mail.sending.current, {})).remaining).toBe(80);

    // a lower health ceiling is also reflected in the displayed allowance
    await backend.run((ctx) => ctx.db.patch(settingsId, { ceiling: 30 }));
    expect((await admin.query(api.mail.sending.current, {})).remaining).toBe(10);
    await backend.run((ctx) => ctx.db.patch(settingsId, { ceiling: 10 }));
    expect((await admin.query(api.mail.sending.current, {})).remaining).toBe(0);
    expect(await backend.run((ctx) => reserve(ctx, Date.now() + 60000))).toBe(false);
});

test("test_reject_invalid_batch_limits", async () => {
    // malformed approvals leave the existing policy and quota unchanged
    const { backend, admin, settingsId } = await setup();
    const before = await backend.run((ctx) => ctx.db.get(settingsId));
    for (const args of [
        { limit: -1, ceiling: 500 },
        { limit: 0, ceiling: 0 },
        { limit: 0.5, ceiling: 500 },
        { limit: 100, ceiling: 500.5 },
        { limit: 10001, ceiling: 10001 },
    ]) {
        await expect(admin.mutation(api.mail.sending.approve, args)).rejects.toThrow(
            "Choose whole-number limits between 0 and the daily pace, up to 10,000.",
        );
    }
    expect(await backend.run((ctx) => ctx.db.get(settingsId))).toEqual(before);
});

test("campaign queue confirms saved content and audience, while the lock permits only drafts", async () => {
    const { backend, admin } = await setup();
    process.env.MAIL_RECIPIENTS = "test@example.invalid";
    const id = await admin.mutation(api.mail.campaigns.save, {
        subject: "Hello",
        message: "Welcome.",
    });
    const campaign = await backend.run((ctx) => ctx.db.get(id));
    const args = {
        id,
        expectedUpdatedAt: campaign!.updatedAt,
        expectedRecipients: 1,
    };
    await expect(admin.mutation(api.mail.campaigns.queue, args)).rejects.toThrow("lock");
    delete process.env.MAIL_RECIPIENTS;
    await expect(
        admin.mutation(api.mail.campaigns.queue, {
            ...args,
            expectedRecipients: 2,
        }),
    ).rejects.toThrow("count changed");
    await expect(
        admin.mutation(api.mail.campaigns.queue, { ...args, expectedUpdatedAt: 0 }),
    ).rejects.toThrow("changed");
    await admin.mutation(api.mail.campaigns.queue, args);
    await backend.mutation(internal.mail.campaigns.batch, { id });
    await backend.mutation(internal.mail.campaigns.batch, { id });
    expect(await backend.run((ctx) => ctx.db.query("messages").collect())).toHaveLength(1);
    await expect(
        admin.mutation(api.mail.campaigns.save, {
            id,
            subject: "Changed",
            message: "No.",
        }),
    ).rejects.toThrow("drafts");
    await admin.mutation(api.mail.campaigns.cancel, { id });
    const delivery = await backend.run((ctx) => ctx.db.query("messages").first());
    expect(await backend.query(internal.mail.messages.read, { id: delivery!._id })).toBeNull();
});

test("later opt-outs skip queued mail and final retry counters cannot go negative", async () => {
    const { backend, subscriptionId } = await setup();
    const campaignId = await backend.run((ctx) =>
        ctx.db.insert("campaigns", {
            subject: "Hello",
            message: "Welcome",
            status: "queued",
            recipients: [subscriptionId],
            cursor: 1,
            createdAt: 1,
            updatedAt: 1,
        }),
    );
    const id = await backend.run((ctx) =>
        enqueue(
            ctx,
            "campaign-test",
            "test@example.invalid",
            "Hello",
            "",
            subscriptionId,
            0,
            undefined,
            { category: "campaign", campaignId },
        ),
    );
    await backend.run((ctx) =>
        ctx.db.patch(id, {
            attempts: 4,
            status: "queued",
            error: "Temporary provider error",
        }),
    );
    expect(await backend.mutation(internal.mail.messages.claim, { id })).toBe(true);
    expect(await backend.mutation(internal.mail.messages.claim, { id })).toBe(false);
    await backend.mutation(internal.mail.messages.finish, {
        id,
        providerId: "accepted-test",
    });
    const campaign = await backend.run((ctx) => ctx.db.get(campaignId));
    expect(campaign?.failed).toBe(0);
    expect(campaign?.accepted).toBe(1);
    expect(campaign?.finished).toBe(1);
    expect((await backend.run((ctx) => ctx.db.get(id)))?.outcome).toBeUndefined();
    const other = await backend.run((ctx) =>
        enqueue(ctx, "later", "test@example.invalid", "Hello", "", subscriptionId, 0, undefined, {
            category: "campaign",
            campaignId,
        }),
    );
    await backend.mutation(api.mail.subscriptions.unsubscribe, {
        token: "private-unsubscribe-token",
    });
    expect(await backend.query(internal.mail.messages.read, { id: other })).toBeNull();
});

test("signed callbacks reconcile before acceptance, deduplicate and never undo suppression", async () => {
    const { backend, subscriptionId, settingsId } = await setup();
    const id = await backend.run((ctx) =>
        enqueue(
            ctx,
            "callback-test",
            "test@example.invalid",
            "Hello",
            "Hello",
            subscriptionId,
            0,
            undefined,
            { category: "weekly" },
        ),
    );
    const bounce = signed("bounced", "provider-test");
    expect((await backend.fetch("/mail/webhook", bounce)).status).toBe(204);
    await backend.mutation(internal.mail.messages.finish, {
        id,
        providerId: "provider-test",
    });
    expect((await backend.run((ctx) => ctx.db.get(subscriptionId)))?.status).toBe("suppressed");
    expect((await backend.fetch("/mail/webhook", bounce)).status).toBe(204);
    expect(
        (await backend.fetch("/mail/webhook", signed("delivered", "provider-test"))).status,
    ).toBe(204);
    expect((await backend.run((ctx) => ctx.db.get(id)))?.outcome).toBe("bounced");
    expect((await backend.run((ctx) => ctx.db.get(settingsId)))?.bounced).toBe(1);

    // pause on a complaint and halve the reviewed ceiling once
    await backend.run((ctx) => ctx.db.patch(settingsId, { ceiling: 1200 }));
    expect(
        (await backend.fetch("/mail/webhook", signed("complained", "provider-test"))).status,
    ).toBe(204);
    const settings = await backend.run((ctx) => ctx.db.get(settingsId));
    expect((await backend.run((ctx) => ctx.db.query("mailPolicy").unique()))?.isPaused).toBe(true);
    expect(settings?.complained).toBe(1);
    expect(settings?.ceiling).toBe(600);
    expect(settings?.stoppedOn).toBe(sendingDate(Date.now()));
    await backend.mutation(api.mail.subscriptions.unsubscribe, {
        token: "private-unsubscribe-token",
    });
    expect((await backend.run((ctx) => ctx.db.get(subscriptionId)))?.status).toBe("suppressed");
});

test("test_suppress_hard_bounces_without_pausing_or_reducing_pace", async () => {
    // exceed the former bounce threshold while retaining the approved sending policy
    const { backend, subscriptionId, settingsId } = await setup();
    await backend.run((ctx) => ctx.db.patch(settingsId, { accepted: 100, bounced: 2 }));
    const policy = await backend.run((ctx) => ctx.db.query("mailPolicy").unique());
    const id = await backend.run((ctx) =>
        enqueue(
            ctx,
            "bounce-threshold",
            "test@example.invalid",
            "Hello",
            "Hello",
            subscriptionId,
            0,
            undefined,
            { category: "weekly" },
        ),
    );

    // process a signed permanent bounce and preserve suppression and accounting
    await backend.mutation(internal.mail.messages.finish, { id, providerId: "threshold-test" });
    const quota = await backend.run((ctx) => ctx.db.get(settingsId));
    if (!quota) throw new Error("Expected the seeded mail quota.");
    expect((await backend.fetch("/mail/webhook", signed("bounced", "threshold-test"))).status).toBe(
        204,
    );
    expect((await backend.run((ctx) => ctx.db.get(subscriptionId)))?.status).toBe("suppressed");
    expect((await backend.run((ctx) => ctx.db.get(id)))?.outcome).toBe("bounced");
    expect(await backend.run((ctx) => ctx.db.get(settingsId))).toEqual({ ...quota, bounced: 3 });
    expect(await backend.run((ctx) => ctx.db.query("mailPolicy").unique())).toEqual(policy);
});

test("forged and stale callbacks are rejected without changing subscribers", async () => {
    const { backend, subscriptionId } = await setup();
    const forged = signed("bounced", "provider-test");
    forged.body = forged.body.replace("bounced", "complained");
    expect((await backend.fetch("/mail/webhook", forged)).status).toBe(400);
    expect(
        (
            await backend.fetch(
                "/mail/webhook",
                signed("bounced", "provider-test", "stale", new Date(Date.now() - 3600000)),
            )
        ).status,
    ).toBe(400);
    expect(await backend.run((ctx) => ctx.db.query("deliveryEvents").collect())).toHaveLength(0);
    expect((await backend.run((ctx) => ctx.db.get(subscriptionId)))?.status).toBe("subscribed");
});

test("one-click unsubscribe requires POST; link previews and unrelated tokens cannot opt anyone out", async () => {
    const { backend, subscriptionId } = await setup();
    const path = "/mail/unsubscribe?token=private-unsubscribe-token";
    expect((await backend.fetch(path)).status).toBe(303);
    expect((await backend.run((ctx) => ctx.db.get(subscriptionId)))?.status).toBe("subscribed");
    const request = { method: "POST", body: "List-Unsubscribe=One-Click" };
    expect((await backend.fetch("/mail/unsubscribe?token=unknown", request)).status).toBe(400);
    expect((await backend.fetch(path, request)).status).toBe(200);
    expect((await backend.fetch(path, request)).status).toBe(200);
    expect((await backend.run((ctx) => ctx.db.get(subscriptionId)))?.status).toBe("unsubscribed");
    expect(unsubscribeHeaders("private-unsubscribe-token")?.["List-Unsubscribe-Post"]).toBe(
        "List-Unsubscribe=One-Click",
    );
});

test("temporary bounces do not permanently suppress recipients", async () => {
    const { backend, subscriptionId } = await setup();
    const id = await backend.run((ctx) =>
        enqueue(
            ctx,
            "temporary-bounce",
            "test@example.invalid",
            "Hello",
            "Hello",
            subscriptionId,
            0,
            undefined,
            { category: "weekly" },
        ),
    );
    await backend.mutation(internal.mail.messages.finish, {
        id,
        providerId: "temporary",
    });
    await backend.mutation(internal.mail.webhooks.record, {
        providerId: "temporary",
        providerEventId: "temporary-event",
        type: "bounced",
        bounceType: "Temporary",
    });
    expect((await backend.run((ctx) => ctx.db.get(subscriptionId)))?.status).toBe("subscribed");
    expect((await backend.run((ctx) => ctx.db.get(id)))?.outcome).toBe("failed");
});

test("weekly scheduling is Monday 08:00 Zurich in summer and winter, and skips empty editions", async () => {
    for (const time of ["2026-09-14T06:00:00Z", "2026-12-14T07:00:00Z"]) {
        setSystemTime(new Date(time));
        const { backend, memberId } = await setup();
        await backend.mutation(internal.mail.newsletter.tick, {});
        expect(await backend.run((ctx) => ctx.db.query("mailSchedules").first())).toBeNull();
        await backend.run((ctx) =>
            ctx.db.insert("events", {
                title: "Test",
                ownerId: memberId,
                slug: "test",
                format: "talk",
                description: "",
                topics: [],
                startsAt: Date.now() + 86400000,
                location: "Test",
                registration: { kind: "none" },
                status: "scheduled",
                createdAt: 1,
                updatedAt: 1,
            }),
        );
        setSystemTime(new Date(new Date(time).getTime() - 3600000));
        await backend.mutation(internal.mail.newsletter.tick, {});
        expect(await backend.run((ctx) => ctx.db.query("mailSchedules").first())).toBeNull();
        setSystemTime(new Date(time));
        await backend.run((ctx) => ctx.db.insert("mailSchedules", { isPaused: false }));
        await backend.mutation(internal.mail.newsletter.tick, {});
        expect((await backend.run((ctx) => ctx.db.query("mailSchedules").first()))?.lastWeek).toBe(
            time.slice(0, 10),
        );
    }
});

test("scheduled audiences freeze at start, content stays fixed, and pause preserves queued work", async () => {
    const { backend, admin } = await setup();
    const id = await admin.mutation(api.mail.campaigns.save, {
        subject: "Schedule",
        message: "Original text.",
    });
    const draft = await backend.run((ctx) => ctx.db.get(id));
    const at = Date.now() + 60000;
    await admin.mutation(api.mail.campaigns.queue, {
        id,
        expectedUpdatedAt: draft!.updatedAt,
        expectedRecipients: 1,
        scheduledAt: at,
    });
    await backend.run((ctx) =>
        ctx.db.insert("subscriptions", {
            email: "second@example.invalid",
            status: "subscribed",
            token: "second-token",
            createdAt: 2,
            updatedAt: 2,
        }),
    );
    setSystemTime(at);
    await backend.mutation(internal.mail.campaigns.tick, {});
    await backend.mutation(internal.mail.campaigns.batch, { id });
    const messages = await backend.run((ctx) => ctx.db.query("messages").collect());
    expect(messages).toHaveLength(2);
    expect(messages[0].text).toContain("Original text.");
    expect(messages[0].html).not.toContain("mail.invalid");
    await admin.mutation(api.mail.campaigns.pause, { id, isPaused: true });
    expect(await backend.mutation(internal.mail.messages.claim, { id: messages[0]._id })).toBe(
        false,
    );
    expect(
        await backend.query(internal.mail.messages.read, { id: messages[0]._id }),
    ).not.toBeNull();
    await admin.mutation(api.mail.campaigns.pause, { id, isPaused: false });
    await backend.run((ctx) =>
        ctx.db.insert("subscriptions", {
            email: "late@example.invalid",
            status: "subscribed",
            token: "late-token",
            createdAt: 3,
            updatedAt: 3,
        }),
    );
    await backend.mutation(internal.mail.campaigns.batch, { id });
    expect(await backend.run((ctx) => ctx.db.query("messages").collect())).toHaveLength(2);
    await backend.finishAllScheduledFunctions(() => {});
});

test("temporary failures remain queued; terminal failures never claim again", async () => {
    const { backend, subscriptionId } = await setup();
    const id = await backend.run((ctx) =>
        enqueue(
            ctx,
            "retry",
            "test@example.invalid",
            "Retry",
            "Frozen",
            subscriptionId,
            0,
            undefined,
            { category: "weekly" },
        ),
    );
    await backend.mutation(internal.mail.messages.claim, { id });
    await backend.mutation(internal.mail.messages.finish, { id, error: "Unavailable" });
    expect((await backend.run((ctx) => ctx.db.get(id)))?.status).toBe("queued");
    expect(await backend.mutation(internal.mail.messages.claim, { id })).toBe(false);
    await backend.run((ctx) => ctx.db.patch(id, { attempts: 5 }));
    await backend.mutation(internal.mail.messages.finish, { id, error: "Unavailable" });
    expect((await backend.run((ctx) => ctx.db.get(id)))?.status).toBe("failed");
    expect(await backend.mutation(internal.mail.messages.claim, { id })).toBe(false);
});

test("scoped organisers cannot read or send global campaigns or campaigns for another event", async () => {
    const { backend, admin, memberId } = await setup();
    const ids = await backend.run(async (ctx) => {
        const accountId = await ctx.db.insert("accounts", {
            authId: "organiser",
            memberId,
            status: "active",
            isTeam: true,
            isAdmin: false,
            createdAt: 1,
            updatedAt: 1,
        });
        const event = {
            ownerId: memberId,
            title: "Test",
            format: "talk" as const,
            description: "",
            topics: [],
            startsAt: Date.now() + 86400000,
            registration: { kind: "none" as const },
            status: "scheduled" as const,
            createdAt: 1,
            updatedAt: 1,
        };
        const eventId = await ctx.db.insert("events", { ...event, slug: "first" });
        const otherId = await ctx.db.insert("events", { ...event, slug: "other" });
        await ctx.db.insert("accessGrants", {
            accountId,
            scope: { kind: "event", id: eventId },
            role: "organiser",
            updatedAt: 1,
        });
        return { eventId, otherId };
    });
    const organiser = backend.withIdentity({ subject: "organiser" });
    const global = await admin.mutation(api.mail.campaigns.save, {
        subject: "Global",
        message: "Private",
    });
    const scoped = await organiser.mutation(api.mail.campaigns.save, {
        subject: "Event",
        message: "An update",
        audience: { kind: "registrations", eventId: ids.eventId, status: "active" },
    });
    expect(
        (await organiser.query(api.mail.campaigns.list, { eventId: ids.eventId })).campaigns,
    ).toHaveLength(1);
    await expect(organiser.query(api.mail.campaigns.preview, { id: global })).rejects.toThrow();
    await expect(organiser.query(api.mail.campaigns.list, {})).rejects.toThrow();
    await expect(
        organiser.mutation(api.mail.campaigns.save, {
            id: scoped,
            subject: "Escape",
            message: "No",
            audience: { kind: "subscribers" },
        }),
    ).rejects.toThrow();
    await expect(
        organiser.mutation(api.mail.campaigns.save, {
            subject: "Other",
            message: "No",
            audience: { kind: "registrations", eventId: ids.otherId, status: "active" },
        }),
    ).rejects.toThrow();
});

test("self-test refuses a verified account outside the delivery lock", async () => {
    const { backend, admin } = await setup();
    const id = await admin.mutation(api.mail.campaigns.save, {
        subject: "Test",
        message: "Preview",
    });
    process.env.MAIL_RECIPIENTS = "somebody-else@example.invalid";
    await expect(admin.mutation(api.mail.campaigns.test, { id })).rejects.toThrow("allowlist");
    expect(await backend.run((ctx) => ctx.db.query("messages").collect())).toHaveLength(0);
});

test("revoking sender access pauses queued written mail before a provider attempt", async () => {
    const { backend, admin } = await setup();
    const id = await admin.mutation(api.mail.campaigns.save, {
        subject: "Access",
        message: "A scheduled notice",
    });
    const draft = await backend.run((ctx) => ctx.db.get(id));
    await admin.mutation(api.mail.campaigns.queue, {
        id,
        expectedUpdatedAt: draft!.updatedAt,
        expectedRecipients: 1,
    });
    await backend.mutation(internal.mail.campaigns.batch, { id });
    await backend.finishAllScheduledFunctions(() => {});
    const message = await backend.run((ctx) => ctx.db.query("messages").first());
    await backend.run(async (ctx) => {
        const account = await ctx.db.query("accounts").first();
        await ctx.db.patch(account!._id, { isAdmin: false });
    });
    expect(await backend.mutation(internal.mail.messages.claim, { id: message!._id })).toBe(false);
    expect((await backend.run((ctx) => ctx.db.get(id)))?.status).toBe("paused");
    expect((await backend.run((ctx) => ctx.db.get(message!._id)))?.attempts).toBe(0);
});

test("test messages keep their history without advancing a draft campaign", async () => {
    const { backend } = await setup();
    const result = await backend.run(async (ctx) => {
        const campaignId = await ctx.db.insert("campaigns", {
            subject: "Preview",
            message: "Hello",
            status: "draft",
            createdAt: 1,
            updatedAt: 1,
        });
        const id = await ctx.db.insert("messages", {
            key: "self-test",
            to: "test@example.invalid",
            subject: "Preview",
            text: "Hello",
            campaignId,
            isTest: true,
            isBulk: false,
            status: "queued",
            attempts: 1,
            createdAt: 1,
            nextAttemptAt: 1,
        });
        const message = (await ctx.db.get(id))!;
        await updateMessage(ctx, message, { status: "accepted", providerId: "test-provider" });
        const accepted = (await ctx.db.get(id))!;
        await updateMessage(ctx, accepted, { outcome: "delivered" });
        return { campaign: await ctx.db.get(campaignId), message: await ctx.db.get(id) };
    });
    expect(result.campaign?.status).toBe("draft");
    expect(result.campaign?.accepted).toBeUndefined();
    expect(result.campaign?.delivered).toBeUndefined();
    expect(result.campaign?.finished).toBeUndefined();
    expect(result.message?.status).toBe("accepted");
    expect(result.message?.outcome).toBe("delivered");
});

test("delivery settings show today's quota without granting a new approval", async () => {
    setSystemTime(new Date("2026-09-15T06:00:00Z"));
    const { backend, admin, settingsId } = await setup();
    await backend.run(async (ctx) => {
        await ctx.db.patch(settingsId, { date: "2026-09-14", count: 300 });
    });

    // project the next day's usage in the view only
    const settings = await admin.query(api.mail.sending.current, {});
    expect(settings.count).toBe(0);
    expect(settings.limits).toEqual({ daily: 500, hourly: 63 });
    expect((await backend.run((ctx) => ctx.db.get(settingsId)))?.ceiling).toBe(500);

    // store the projection once an email is reserved
    expect(await backend.run((ctx) => reserve(ctx, Date.now()))).toBe(true);
    expect((await admin.query(api.mail.sending.current, {})).count).toBe(1);
    expect((await backend.run((ctx) => ctx.db.get(settingsId)))?.ceiling).toBe(500);
});

// Warmup depends on reaching recently interested people before dormant imports.
test("frozen audiences order recipients by their latest real interest", async () => {
    const { backend, memberId } = await setup();
    const order = await backend.run(async (ctx) => {
        const eventId = await ctx.db.insert("events", {
            title: "Test",
            ownerId: memberId,
            slug: "test",
            format: "talk",
            description: "",
            topics: [],
            startsAt: 1,
            location: "Test",
            registration: { kind: "none" },
            status: "scheduled",
            createdAt: 1,
            updatedAt: 1,
        });
        const subscribe = (email: string, fields: object) =>
            ctx.db.insert("subscriptions", {
                email,
                status: "subscribed",
                token: email,
                createdAt: 1,
                updatedAt: 1,
                ...fields,
            });

        // interest from a registration, a confirmation, a recorded signup and an observation
        const registered = await subscribe("registered@example.invalid", { memberId });
        await ctx.db.insert("registrations", {
            eventId,
            memberId,
            name: "Registered",
            email: "registered@example.invalid",
            status: "going",
            token: "registered",
            createdAt: 400,
            updatedAt: 400,
        });
        const confirmed = await subscribe("confirmed@example.invalid", { verifiedAt: 300 });
        const recorded = await subscribe("recorded@example.invalid", {
            history: [{ at: 200, status: "subscribed", weekly: true, source: "wix" }],
        });
        const observed = await subscribe("observed@example.invalid", {
            history: [
                { at: 900, status: "subscribed", weekly: true, source: "x", isEstimated: true },
            ],
        });

        return {
            expected: [registered, confirmed, recorded, observed],
            actual: (await rank(ctx, [observed, recorded, confirmed, registered])).map(
                (row) => row.id,
            ),
        };
    });
    expect(order.actual).toEqual(order.expected);
});

test("test_rank_recent_repeat_registrants_before_older_imports", async () => {
    const now = Date.UTC(2026, 8, 28);
    const { backend, memberId } = await setup();
    const result = await backend.run(async (ctx) => {
        // give an old import a recent creation timestamp to exercise the event-date cap
        const events = [];
        for (const days of [10, 20, 400]) {
            events.push(
                await ctx.db.insert("events", {
                    ownerId: memberId,
                    title: "Example",
                    slug: `event-${days}`,
                    format: "talk",
                    description: "",
                    topics: [],
                    startsAt: now - days * 86400000,
                    location: "Zurich",
                    registration: { kind: "none" },
                    status: "scheduled",
                    createdAt: 1,
                    updatedAt: 1,
                }),
            );
        }

        // match historical email-only rows and deduplicate repeated registrations for one event
        const ids = [];
        for (const [index, name] of ["repeat", "recent", "old", "cancelled"].entries()) {
            const email = `${name}@example.invalid`;
            ids.push(
                await ctx.db.insert("subscriptions", {
                    email,
                    status: "subscribed",
                    token: name,
                    createdAt: now,
                    updatedAt: now,
                }),
            );
            const eventIds =
                index === 0 ? [events[0], events[1], events[1]] : [events[index === 2 ? 2 : 0]];
            for (const eventId of eventIds) {
                await ctx.db.insert("registrations", {
                    email: email.toUpperCase(),
                    name,
                    eventId,
                    status: index === 3 ? "cancelled" : "going",
                    createdAt: now,
                    updatedAt: now,
                });
            }
        }

        return (await rank(ctx, ids.toReversed(), now)).map(({ email, cohort, events }) => ({
            email,
            cohort,
            events,
        }));
    });
    expect(result).toEqual([
        { email: "repeat@example.invalid", cohort: 0, events: 2 },
        { email: "recent@example.invalid", cohort: 0, events: 1 },
        { email: "old@example.invalid", cohort: 2, events: 1 },
        { email: "cancelled@example.invalid", cohort: 3, events: 0 },
    ]);
});

test("newsletter preview counts the same eligible audience as delivery", async () => {
    const { backend, admin } = await setup();
    await backend.run(async (ctx) => {
        for (const fields of [
            { email: "missing@example.invalid" },
            { email: "optout@example.invalid", token: "optout", weekly: false },
        ]) {
            await ctx.db.insert("subscriptions", {
                ...fields,
                status: "subscribed",
                createdAt: 1,
                updatedAt: 1,
            });
        }
    });
    expect((await admin.query(api.mail.newsletter.preview, {})).subscribers).toBe(1);
});

// A locked verification must fail before creating a ticket or silently queued mail.
test("test mode rejects blocked newsletter verification without retaining a request", async () => {
    const backend = convexTest(schema, mailModules);
    process.env.MAIL_RECIPIENTS = "test@example.invalid";
    await expect(
        backend.action(api.mail.subscriptions.subscribe, { email: "blocked@example.invalid" }),
    ).rejects.toThrow("Test mode: No email was sent");
    await expect(
        backend.query(api.mail.delivery.check, { email: "blocked@example.invalid" }),
    ).rejects.toThrow("Test mode: No email was sent");
    expect(
        await backend.query(api.mail.delivery.check, { email: "TEST@example.invalid" }),
    ).toBeNull();
    await backend.run(async (ctx) => {
        expect(await ctx.db.query("verifications").collect()).toEqual([]);
        expect(await ctx.db.query("messages").collect()).toEqual([]);
        expect(await ctx.db.query("subscriptions").collect()).toEqual([]);
    });
});

// Transactional verification remains available while broadcasts are paused, but never after expiry.
test("confirmation mail expires with its ticket while bulk delivery stays paused", async () => {
    const { backend, admin } = await setup();
    const now = Date.now();
    setSystemTime(now);
    await admin.mutation(api.mail.sending.configure, { isPaused: true });
    await backend.mutation(internal.mail.verification.prepare, {
        email: "new@example.invalid",
        name: "",
        token: "confirmation-test",
        newsletterToken: "unsubscribe-test",
        purpose: "subscription",
    });
    const message = await backend.run(async (ctx) => ctx.db.query("messages").unique());
    expect(await backend.query(internal.mail.messages.read, { id: message!._id })).not.toBeNull();
    expect(await backend.run((ctx) => reserve(ctx, now))).toBe(false);
    setSystemTime(now + 3600000);
    expect(await backend.query(internal.mail.messages.read, { id: message!._id })).toBeNull();
});

// Signup defaults must never overwrite deliberate opt-outs or narrower preferences.
test("new accounts enable every email category and preserve existing subscription choices", async () => {
    const { backend, memberId } = await setup();
    await backend.mutation(internal.mail.preferences.subscribe, {
        email: "NEW@example.invalid",
        memberId,
        token: "new-token",
    });
    const row = await backend.run((ctx) =>
        ctx.db
            .query("subscriptions")
            .withIndex("by_email", (q) => q.eq("email", "new@example.invalid"))
            .unique(),
    );
    expect(row).toMatchObject({
        status: "subscribed",
        weekly: true,
        announcements: true,
        reminders: true,
        followUps: true,
        source: "account",
        memberId,
    });
    for (const status of ["subscribed", "unsubscribed", "suppressed"] as const) {
        await backend.run((ctx) =>
            ctx.db.patch(row!._id, { status, weekly: false, followUps: false }),
        );
        const before = await backend.run((ctx) => ctx.db.get(row!._id));
        await backend.mutation(internal.mail.preferences.subscribe, {
            email: row!.email,
            memberId,
            token: "replacement",
        });
        expect(await backend.run((ctx) => ctx.db.get(row!._id))).toEqual(before);
    }
});

// Registration and enrollment commit together; a repeat RSVP must not undo an unsubscribe.
test("verified event registration enrolls once and explicit resubscription enables all preferences", async () => {
    const { backend, memberId } = await setup();
    const eventId = await backend.run((ctx) =>
        ctx.db.insert("events", {
            ownerId: memberId,
            slug: "enrollment",
            title: "Enrollment",
            format: "talk",
            description: "",
            topics: [],
            startsAt: Date.now() + 86400000,
            registration: {
                kind: "native",
                admission: "automatic",
                capacity: 10,
                overflow: "waitlist",
                questions: [],
            },
            status: "scheduled",
            createdAt: 1,
            updatedAt: 1,
        }),
    );
    async function confirm(token: string, purpose: "registration" | "subscription") {
        await backend.run((ctx) =>
            ctx.db.insert("verifications", {
                email: "guest@example.invalid",
                name: "Guest",
                eventId,
                purpose,
                token,
                newsletterToken: `unsubscribe-${token}`,
                answers: [],
                expiresAt: Date.now() + 3600000,
            }),
        );
        return backend.mutation(api.mail.verification.confirm, { token });
    }
    // signed-in registration also enrols if account enrollment has not run yet
    await backend.run(async (ctx) => {
        const subscription = await ctx.db.query("subscriptions").unique();
        await ctx.db.delete(subscription!._id);
    });
    await backend
        .withIdentity({ subject: "admin" })
        .mutation(internal.events.registrations.joinMember, {
            eventSlug: "enrollment",
            answers: [],
            token: "account-registration",
            newsletterToken: "account-unsubscribe",
        });
    expect(await backend.run((ctx) => ctx.db.query("subscriptions").unique())).toMatchObject({
        email: "test@example.invalid",
        memberId,
        weekly: true,
        announcements: true,
        reminders: true,
        followUps: true,
        token: "account-unsubscribe",
    });
    await confirm("first", "registration");
    const row = await backend.run((ctx) =>
        ctx.db
            .query("subscriptions")
            .withIndex("by_email", (q) => q.eq("email", "guest@example.invalid"))
            .unique(),
    );
    expect(row).toMatchObject({
        status: "subscribed",
        weekly: true,
        announcements: true,
        reminders: true,
        followUps: true,
        source: "registration",
        token: "unsubscribe-first",
    });
    expect(await backend.run((ctx) => ctx.db.query("registrations").collect())).toHaveLength(2);
    await backend.mutation(api.mail.subscriptions.unsubscribe, { token: row!.token! });
    const optedOut = await backend.run((ctx) => ctx.db.get(row!._id));
    await confirm("again", "registration");
    expect(await backend.run((ctx) => ctx.db.get(row!._id))).toEqual(optedOut);
    await confirm("renew", "subscription");
    expect(await backend.run((ctx) => ctx.db.get(row!._id))).toMatchObject({
        status: "subscribed",
        weekly: true,
        announcements: true,
        reminders: true,
        followUps: true,
        token: "unsubscribe-first",
    });
    await backend.run((ctx) => ctx.db.patch(row!._id, { status: "suppressed" }));
    await expect(confirm("blocked", "subscription")).rejects.toThrow("cannot receive email");
});

// Weekly preferences affect delivery, not the public size of the community.
test("member totals and history include announcement-only subscriptions", async () => {
    const { backend, subscriptionId } = await setup();
    await backend.run((ctx) =>
        ctx.db.patch(subscriptionId, { weekly: false, announcements: true }),
    );
    expect(await backend.query(api.statistics.queries.subscribers, {})).toBe(1);
    const stats = await backend.query(api.statistics.queries.community, {});
    expect(stats.totals.subscribers).toBe(1);
    expect(stats.history.subscribers[0]?.value).toBe(1);
    expect(stats.history.subscribers.at(-1)?.value).toBe(1);
    await backend.mutation(api.mail.subscriptions.unsubscribe, {
        token: "private-unsubscribe-token",
    });
    expect(await backend.query(api.statistics.queries.subscribers, {})).toBe(0);
});
