import { afterEach, beforeEach, expect, mock, test, setSystemTime } from "bun:test";
import { convexTest } from "convex-test";
import { httpRouter, type GenericQueryCtx, type GenericDataModel } from "convex/server";
import { Webhook } from "svix";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { quotaDefaults, reserve } from "../convex/mail/sending";
import { updateMessage } from "../convex/mail/progress";
import { enqueue } from "../convex/mail/messages";
import { unsubscribeHeaders } from "../convex/mail/provider";
import { receive, unsubscribe } from "../convex/mail/webhooks";

mock.module("../convex/auth/component", () => ({
    authComponent: {
        getAuthUser: async (ctx: GenericQueryCtx<GenericDataModel>) => {
            const identity = await ctx.auth.getUserIdentity();
            if (!identity) throw new Error("Sign in required.");
            return {
                _id: identity.subject,
                email: "test@example.invalid",
                emailVerified: true,
            };
        },
    },
}));

const http = httpRouter();
http.route({ path: "/mail/webhook", method: "POST", handler: receive });
http.route({ path: "/mail/unsubscribe", method: "POST", handler: unsubscribe });
http.route({ path: "/mail/unsubscribe", method: "GET", handler: unsubscribe });
const modules = {
    ...Object.fromEntries(
        [...new Bun.Glob("**/*.ts").scanSync({ cwd: "convex" })].map((path) => [
            `../convex/${path}`,
            () => import(`../convex/${path}`),
        ]),
    ),
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
    const backend = convexTest(schema, modules);
    const ids = await backend.run(async (ctx) => {
        const memberId = await ctx.db.insert("members", {
            name: "Test",
            status: "active",
            searchText: "test",
            visibility: "private",
            createdAt: 1,
            updatedAt: 1,
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
        await ctx.db.insert("mailPolicy", { isPaused: false, profile: "new" });
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
    eventId = crypto.randomUUID(),
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
    const { backend, admin, settingsId } = await setup();
    const now = Date.UTC(2026, 8, 14, 6);
    expect(await backend.run((ctx) => reserve(ctx, now))).toBe(true);
    expect(await backend.run((ctx) => reserve(ctx, now + 1))).toBe(false);
    expect(await backend.run((ctx) => reserve(ctx, now + 144000))).toBe(true);
    await backend.run((ctx) => ctx.db.patch(settingsId, { count: 150 }));
    expect(await backend.run((ctx) => reserve(ctx, now + 3600000))).toBe(false);
    expect(await backend.run((ctx) => reserve(ctx, now + 10 * 86400000))).toBe(true);
    const settings = await backend.run((ctx) => ctx.db.get(settingsId));
    expect(settings?.day).toBe(1); // idle days do not pretend to warm the domain
    process.env.MAIL_RECIPIENTS = "test@example.invalid";
    expect(await backend.run((ctx) => reserve(ctx, now + 11 * 86400000))).toBe(false);
    await expect(
        admin.mutation(api.mail.sending.configure, {
            isPaused: false,
            profile: "complete",
        }),
    ).rejects.toThrow("lock");
    await expect(
        backend.mutation(api.mail.sending.configure, {
            isPaused: false,
            profile: "new",
        }),
    ).rejects.toThrow();
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
    expect(
        (await backend.fetch("/mail/webhook", signed("complained", "provider-test"))).status,
    ).toBe(204);
    const settings = await backend.run((ctx) => ctx.db.get(settingsId));
    expect((await backend.run((ctx) => ctx.db.query("mailPolicy").unique()))?.isPaused).toBe(true);
    expect(settings?.complained).toBe(1);
    await backend.mutation(api.mail.subscriptions.unsubscribe, {
        token: "private-unsubscribe-token",
    });
    expect((await backend.run((ctx) => ctx.db.get(subscriptionId)))?.status).toBe("suppressed");
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

test("delivery settings show today's quota without advancing idle days", async () => {
    const { backend, admin, settingsId } = await setup();
    setSystemTime(new Date("2026-09-15T06:00:00Z"));
    await backend.run(async (ctx) => {
        await ctx.db.patch(settingsId, { date: "2026-09-14", count: 100, day: 0 });
    });
    const settings = await admin.query(api.mail.sending.current, {});
    expect(settings.count).toBe(0);
    expect(settings.day).toBe(1);
    expect(settings.limits.daily).toBe(250);
    setSystemTime(new Date("2026-09-20T06:00:00Z"));
    expect((await admin.query(api.mail.sending.current, {})).day).toBe(1);
    expect(await backend.run((ctx) => reserve(ctx, Date.now()))).toBe(true);
    expect((await admin.query(api.mail.sending.current, {})).count).toBe(1);
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
