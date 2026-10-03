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
import { rank, select } from "../convex/mail/audiences";
import { prioritize } from "../scripts/mail/order";
import { personalize } from "../convex/mail/personalization";
import { eventEmail, newsletterEdition, newsletterEmail } from "../convex/mail/templates";
import { attendanceCopy, resourcesPlaceholder, welcome } from "../convex/mail/attendance";
import { profilePlaceholder } from "../convex/mail/involvement";
import { digestNews } from "../convex/mail/newsletter";

test("test_freeze_published_speakers_and_programme_in_announcement_order", async () => {
    const { backend, admin, eventId } = await announcement();
    await backend.run(async (ctx) => {
        for (const [name, position, isRemoved] of [
            ["Second speaker", 2, false],
            ["Removed speaker", 0, true],
            ["First speaker", 1, false],
        ] as const) {
            await ctx.db.insert("speakers", {
                eventId,
                name,
                position,
                isRemoved,
                createdAt: 1,
                updatedAt: 1,
            });
        }
        await ctx.db.insert("sessions", {
            eventId,
            time: "18:30",
            title: "Published talk",
            position: 0,
            createdAt: 1,
            updatedAt: 1,
        });
    });
    const id = await admin.mutation(api.mail.campaigns.announcement, {
        eventId,
        audience: { kind: "subscribers", excludeEventId: eventId },
    });
    const campaign = await backend.run((ctx) => ctx.db.get(id));
    expect(campaign!.message).toContain(
        "Speakers\nFirst speaker\nSecond speaker\n\nProgramme\n18:30 · Published talk",
    );
    expect(campaign!.message).not.toContain("Removed speaker");
});

test("test_reference_only_checked_in_attendees_and_recent_public_resources", async () => {
    const { backend, eventId, memberId, subscriptionId } = await announcement();
    const now = Date.now();
    const pastId = await backend.run(async (ctx) => {
        const seriesId = await ctx.db.insert("series", {
            name: "NLP",
            slug: "nlp",
            description: "",
            topics: [],
            status: "active",
        });
        await ctx.db.patch(eventId, { seriesId });
        const { _id, _creationTime, ...event } = (await ctx.db.get(eventId))!;
        const pastId = await ctx.db.insert("events", {
            ...event,
            title: "NLP <21>",
            slug: "nlp-21",
            status: "finished",
            startsAt: now - 10 * 86400000,
        });
        await ctx.db.insert("registrations", {
            eventId: pastId,
            memberId,
            email: "test@example.invalid",
            name: "Test",
            status: "going",
            createdAt: 1,
            updatedAt: 1,
        });
        return pastId;
    });
    const invitation = await backend.run(async (ctx) =>
        eventEmail((await ctx.db.get(eventId))!, "New event", { eventId }),
    );
    const render = () => backend.run((ctx) => personalize(ctx, invitation, subscriptionId));
    expect((await render())!.text).toContain(welcome);

    // an RSVP alone is not attendance; an actual guest check-in is
    await backend.run((ctx) =>
        ctx.db.insert("attendances", {
            eventId: pastId,
            email: "test@example.invalid",
            memberId,
            checkedInAt: now - 10 * 86400000,
            method: "qr",
            createdAt: 1,
        }),
    );
    const attended = (await render())!;
    expect(attended.text).toContain("You joined us for NLP <21>.");
    expect(attended.html).toContain("You joined us for NLP &lt;21&gt;.");
    expect(attended.text).not.toContain(welcome);

    const request = { kind: "resources" as const, since: now - 7 * 86400000, until: now };
    const read = () =>
        backend.run((ctx) => attendanceCopy(ctx, request, "test@example.invalid", memberId));
    expect(await read()).toEqual({ html: "", text: "" });
    const linkId = await backend.run((ctx) =>
        ctx.db.insert("links", {
            ownerId: pastId,
            kind: "other",
            label: "Slides",
            url: "https://example.com/slides",
            position: 0,
            visibility: "private",
            createdAt: now - 1,
            updatedAt: now - 1,
        }),
    );
    expect(await read()).toEqual({ html: "", text: "" });
    await backend.run((ctx) => ctx.db.patch(linkId, { visibility: "public" }));
    const resources = await read();
    expect(resources.text).toBe(
        "From events you attended\n\nNLP <21>\nEvent links: https://example.invalid/events/nlp-21",
    );
    expect(resources.html).toContain("Event links");
    expect(resources.html).not.toContain("example.com/slides");

    // resolve the section in a real newsletter and remove it outside its edition window
    const newsletter = newsletterEmail(newsletterEdition([], [], [], { date: now }));
    const rendered = (await backend.run((ctx) => personalize(ctx, newsletter, subscriptionId)))!;
    expect(rendered.text).toContain(resources.text);
    expect(rendered.text).not.toContain(resourcesPlaceholder.text);
    expect(rendered.html).not.toContain(resourcesPlaceholder.html);
    await backend.run((ctx) => ctx.db.patch(linkId, { createdAt: request.since, updatedAt: now }));
    expect(await read()).toEqual({ html: "", text: "" });

    // approved recent photos qualify; pending photos and unlisted events do not
    const photoId = await backend.run((ctx) =>
        ctx.db.insert("photos", {
            eventId: pastId,
            uploaderId: memberId,
            status: "pending",
            key: "photo",
            thumbnailKey: "thumbnail",
            position: 0,
            width: 100,
            height: 100,
            createdAt: now - 1,
            updatedAt: now - 1,
        }),
    );
    expect(await read()).toEqual({ html: "", text: "" });
    await backend.run((ctx) => ctx.db.patch(photoId, { status: "approved" }));
    expect((await read()).html).toContain("nlp-21#photos");
    await backend.run((ctx) => ctx.db.patch(pastId, { visibility: "unlisted" }));
    expect(await read()).toEqual({ html: "", text: "" });
    expect((await render())!.text).toContain(welcome);
});

test("test_personalize_newsletter_profiles_without_using_private_survey_or_visibility", async () => {
    const { backend, subscriptionId, memberId } = await setup();
    const content = newsletterEmail(newsletterEdition([], []));
    const render = () => backend.run((ctx) => personalize(ctx, content, subscriptionId));
    expect((await render())!.text).toContain("Create your profile");

    // resolve an existing account through its verified email even without a subscription member id
    await backend.run((ctx) =>
        ctx.db.insert("emails", {
            email: "test@example.invalid",
            memberId,
            isPrimary: true,
            verifiedAt: 1,
            createdAt: 1,
            updatedAt: 1,
        }),
    );
    expect((await render())!.text).toContain("Complete your profile");
    await backend.run(async (ctx) => {
        const account = (await ctx.db.query("accounts").collect())[0];
        await ctx.db.patch(account._id, { demographics: { age: null }, onboardedAt: 1 });
        await ctx.db.patch(memberId, { bio: "I build things.", visibility: "private" });
    });
    const completed = (await render())!;
    expect(completed.text).not.toContain("Complete your profile");
    expect(completed.text).not.toContain(profilePlaceholder.text);
    expect(completed.html).not.toContain(profilePlaceholder.html);
    expect(completed.text).not.toContain("I build things.");
    expect(completed.html).toContain("Join Discord");

    // disabled accounts must not receive a prompt to create or complete an account
    await backend.run(async (ctx) => {
        const account = (await ctx.db.query("accounts").collect())[0];
        await ctx.db.patch(account._id, { status: "disabled" });
        await ctx.db.patch(memberId, { bio: undefined });
    });
    expect((await render())!.text).not.toContain("Complete your profile");
});

test("test_select_only_recent_published_news_for_the_digest", async () => {
    const { backend, memberId } = await setup();
    const now = Date.now();
    const posts = await backend.run(async (ctx) => {
        for (const [slug, publishedAt, date, isPublished] of [
            ["recent", now - 1, now - 1, true],
            ["draft", now - 2, now - 2, false],
            ["future", now + 1, now + 1, true],
            ["future-story", now - 3, now + 1, true],
            ["old", now - 7 * 86400000, now - 7 * 86400000, true],
            ["second", now - 4, now - 4, true],
            ["third", now - 5, now - 5, true],
            ["fourth", now - 6, now - 6, true],
        ] as const) {
            const published = {
                title: slug,
                description: "Published copy",
                body: "",
                kind: "post" as const,
                topics: [],
                authors: [],
                organisations: [],
                date,
            };
            await ctx.db.insert("posts", {
                slug,
                publishedAt,
                published: isPublished ? published : undefined,
                draft: { ...published, title: "Unpublished edit" },
                createdBy: memberId,
                updatedAt: now,
            });
        }
        return ctx.db.query("posts").collect();
    });
    expect(digestNews(posts, now)).toEqual(
        ["recent", "second", "third"].map((slug) => ({
            slug,
            title: slug,
            description: "Published copy",
        })),
    );
});

const http = httpRouter();
http.route({ path: "/mail/webhook", method: "POST", handler: receive });
http.route({ path: "/mail/unsubscribe", method: "POST", handler: unsubscribe });
http.route({ path: "/mail/unsubscribe", method: "GET", handler: unsubscribe });
const mailModules = {
    ...modules,
    "../convex/http.ts": async () => ({ default: http }),
};
const secret = `whsec_${btoa("only-a-local-test-secret-for-signatures")}`;

test("test_release_only_reviewed_untouched_campaign_messages", async () => {
    const { backend, subscriptionId } = await setup();
    const ids = await backend.run(async (ctx) => {
        const other = await ctx.db.insert("subscriptions", {
            email: "other@example.invalid",
            status: "subscribed",
            token: "other",
            createdAt: 1,
            updatedAt: 1,
        });
        const campaignId = await ctx.db.insert("campaigns", {
            subject: "Introduction",
            message: "Hello",
            category: "campaign",
            audience: { kind: "subscribers" },
            status: "paused",
            recipients: [subscriptionId, other],
            cursor: 2,
            createdAt: 1,
            updatedAt: 1,
        });
        const selected = await enqueue(
            ctx,
            "reviewed",
            "test@example.invalid",
            "Introduction",
            "Hello",
            subscriptionId,
            0,
            undefined,
            { campaignId, category: "campaign" },
        );
        const excluded = await enqueue(
            ctx,
            "excluded",
            "other@example.invalid",
            "Introduction",
            "Hello",
            other,
            0,
            undefined,
            { campaignId, category: "campaign" },
        );

        return { campaignId, selected, excluded };
    });
    const args = {
        campaignId: ids.campaignId,
        messageIds: [ids.selected],
        source: "Reviewed deliverable audit",
        isDryRun: true,
    };
    // reject consent changes, past deliveries and stale verification candidates
    for (const changes of [
        { status: "suppressed" as const },
        { status: "unsubscribed" as const },
        { hasDeliveryFailure: true },
        { deliveredAt: 1 },
        { weekly: false, announcements: false },
    ]) {
        await backend.run((ctx) => ctx.db.patch(subscriptionId, changes));
        await expect(backend.mutation(internal.mail.ordering.release, args)).rejects.toThrow(
            "Reviewed recipients must be untouched, subscribed and without adverse history.",
        );
        await backend.run((ctx) =>
            ctx.db.patch(subscriptionId, {
                status: "subscribed",
                hasDeliveryFailure: undefined,
                deliveredAt: undefined,
                weekly: undefined,
                announcements: undefined,
            }),
        );
    }
    await expect(
        backend.mutation(internal.mail.ordering.release, {
            ...args,
            messageIds: [ids.selected, ids.selected],
        }),
    ).rejects.toThrow("Provide distinct reviewed messages and their verification source.");

    expect(await backend.mutation(internal.mail.ordering.release, args)).toEqual({
        count: 1,
        released: false,
    });
    expect(await backend.run(async (ctx) => (await ctx.db.get(ids.campaignId))!.status)).toBe(
        "paused",
    );
    expect(
        await backend.mutation(internal.mail.ordering.release, { ...args, isDryRun: false }),
    ).toEqual({ count: 1, released: true });
    expect(await backend.mutation(internal.mail.messages.claim, { id: ids.excluded })).toBe(false);
    expect(await backend.mutation(internal.mail.messages.claim, { id: ids.selected })).toBe(true);
    expect(await backend.mutation(internal.mail.messages.claim, { id: ids.excluded })).toBe(false);
    await expect(
        backend.mutation(internal.mail.ordering.release, { ...args, messageIds: [ids.excluded] }),
    ).rejects.toThrow("The previous reviewed batch has not settled.");

    // keep the unreviewed message untouched and preserve consumed quota
    expect(
        await backend.run(async (ctx) => ({
            attempts: (await ctx.db.get(ids.excluded))!.attempts,
            count: (await ctx.db.query("mailQuota").unique())!.count,
        })),
    ).toEqual({ attempts: 0, count: 1 });

    // carry one accepted delivery forward without retrying or losing its identity
    await backend.run((ctx) => ctx.db.patch(ids.selected, { status: "accepted" }));
    expect(
        await backend.mutation(internal.mail.ordering.release, {
            ...args,
            messageIds: [ids.excluded],
            isDryRun: false,
        }),
    ).toEqual({ count: 1, released: true });
    expect(
        await backend.run(async (ctx) => (await ctx.db.get(ids.campaignId))!.reviewedBatch),
    ).toEqual({ messages: [ids.excluded], source: args.source, pending: [ids.selected] });
    expect(await backend.mutation(internal.mail.messages.claim, { id: ids.selected })).toBe(false);
    expect(await backend.mutation(internal.mail.messages.claim, { id: ids.excluded })).toBe(false);
    setSystemTime(
        Math.ceil(
            await backend.run(async (ctx) => (await ctx.db.query("mailQuota").unique())!.nextAt),
        ),
    );
    expect(await backend.mutation(internal.mail.messages.claim, { id: ids.excluded })).toBe(true);

    // prevent unresolved reports from accumulating over successive batches
    await backend.run((ctx) => ctx.db.patch(ids.excluded, { status: "accepted" }));
    await expect(backend.mutation(internal.mail.ordering.release, args)).rejects.toThrow(
        "More than one reviewed delivery is awaiting a provider outcome.",
    );

    // a late outcome clears the carryover check without resetting consumed attempts
    await backend.run((ctx) => ctx.db.patch(ids.selected, { outcome: "delivered" }));
    await expect(backend.mutation(internal.mail.ordering.release, args)).rejects.toThrow(
        "Reviewed recipients must be untouched, subscribed and without adverse history.",
    );
    expect(
        await backend.run(async (ctx) => (await ctx.db.query("mailQuota").unique())!.count),
    ).toBe(2);
});
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

/** Prepare a local event announcement without contacting a provider. */
async function announcement() {
    const fixture = await setup();
    const eventId = await fixture.backend.run(async (ctx) => {
        const policy = (await ctx.db.query("mailPolicy").unique())!;
        await ctx.db.patch(policy._id, { isHistoryReady: true });
        await ctx.db.patch(fixture.subscriptionId, { deliveredAt: Date.now() });
        return await ctx.db.insert("events", {
            ownerId: fixture.memberId,
            title: "ZurichNLP #22",
            slug: "nlp-22",
            format: "talk",
            description: "Talks",
            topics: [],
            startsAt: Date.now() + 86400000,
            registration: { kind: "none" },
            status: "scheduled",
            createdAt: 1,
            updatedAt: 1,
        });
    });
    const id = await fixture.admin.mutation(api.mail.campaigns.announcement, {
        eventId,
        audience: {
            kind: "subscribers",
            excludeEventId: eventId,
            deliveredSince: Date.now() - 86400000,
        },
    });
    return { ...fixture, eventId, id };
}

test("test_prepare_announcement_without_sending_and_reject_changed_identities", async () => {
    const { backend, admin, id, subscriptionId } = await announcement();
    const preview = await admin.query(api.mail.campaigns.preview, { id });
    expect(preview.subject).toBe("ZurichNLP #22: New event");
    expect(preview.audience!.first.map((row) => row.id)).toEqual([subscriptionId]);
    expect(await backend.run((ctx) => ctx.db.query("messages").collect())).toEqual([]);
    await expect(
        admin.mutation(api.mail.campaigns.queue, {
            id,
            expectedUpdatedAt: preview.updatedAt,
            expectedRecipients: 1,
        }),
    ).rejects.toThrow("Release a reviewed batch instead.");

    // equal counts must not permit an unreviewed replacement address
    await backend.run(async (ctx) => {
        await ctx.db.patch(subscriptionId, { announcements: false });
        await ctx.db.insert("subscriptions", {
            email: "replacement@example.invalid",
            token: "replacement",
            status: "subscribed",
            deliveredAt: Date.now(),
            createdAt: 1,
            updatedAt: 1,
        });
    });
    await expect(
        admin.mutation(api.mail.campaigns.release, {
            id,
            expectedUpdatedAt: preview.updatedAt,
            recipients: [subscriptionId],
        }),
    ).rejects.toThrow("Recipient order changed. Preview the batch again.");
});

test("test_bound_campaign_attempts_and_preserve_global_pacing", async () => {
    const { backend, admin, id, subscriptionId, settingsId } = await announcement();
    const preview = await admin.query(api.mail.campaigns.preview, { id });
    await admin.mutation(api.mail.campaigns.release, {
        id,
        expectedUpdatedAt: preview.updatedAt,
        recipients: [subscriptionId],
    });
    await backend.mutation(internal.mail.campaigns.batch, { id });
    const message = (await backend.run((ctx) => ctx.db.query("messages").collect()))[0];
    expect(await backend.mutation(internal.mail.messages.claim, { id: message._id })).toBe(true);
    const quota = await backend.run((ctx) => ctx.db.get(settingsId));
    expect(quota!.count).toBe(1);

    // even a due retry cannot spend a second attempt from a one-attempt batch
    await backend.run((ctx) => ctx.db.patch(message._id, { nextAttemptAt: 0 }));
    expect(await backend.mutation(internal.mail.messages.claim, { id: message._id })).toBe(false);
    expect(await backend.run((ctx) => ctx.db.get(settingsId))).toEqual(quota);
    expect((await backend.run((ctx) => ctx.db.get(id)))!.attempts).toBe(1);
});

test("test_exclude_announcement_recipients_across_campaigns_and_member_addresses", async () => {
    const { backend, admin, id, eventId, subscriptionId, memberId } = await announcement();
    await backend.run((ctx) => ctx.db.patch(subscriptionId, { memberId }));
    const audience = {
        kind: "subscribers" as const,
        excludeEventId: eventId,
        deliveredSince: Date.now() - 86400000,
    };
    const broader = await admin.mutation(api.mail.campaigns.announcement, { eventId, audience });
    const original = await admin.query(api.mail.campaigns.preview, { id });
    const stale = await admin.query(api.mail.campaigns.preview, { id: broader });
    expect(stale.audience!.first.map((row) => row.id)).toEqual([subscriptionId]);

    // reserve identities atomically before queued messages have been delivered
    await admin.mutation(api.mail.campaigns.release, {
        id,
        expectedUpdatedAt: original.updatedAt,
        recipients: [subscriptionId],
    });
    await expect(
        admin.mutation(api.mail.campaigns.release, {
            id: broader,
            expectedUpdatedAt: stale.updatedAt,
            recipients: [subscriptionId],
        }),
    ).rejects.toThrow("Recipient order changed. Preview the batch again.");

    // exclude aliases and case variations without excluding genuinely new recipients
    const fresh = await backend.run(async (ctx) => {
        const subscription = (await ctx.db.get(subscriptionId))!;
        for (const email of [" TEST@EXAMPLE.INVALID ", "alias@example.invalid"]) {
            await ctx.db.insert("subscriptions", {
                email,
                memberId: email.startsWith("alias") ? memberId : undefined,
                status: "subscribed",
                token: "local-test",
                deliveredAt: subscription.deliveredAt,
                createdAt: 1,
                updatedAt: 1,
            });
        }
        return await ctx.db.insert("subscriptions", {
            email: "fresh@example.invalid",
            status: "subscribed",
            token: "local-test-fresh",
            deliveredAt: Date.now(),
            createdAt: 1,
            updatedAt: 1,
        });
    });
    const preview = await admin.query(api.mail.campaigns.preview, { id: broader });
    expect(preview.audience!.first.map((row) => row.id)).toEqual([fresh]);

    // keep reservations after cancellation instead of silently retrying old recipients
    await backend.run((ctx) => ctx.db.patch(id, { status: "cancelled" }));
    expect((await admin.query(api.mail.campaigns.preview, { id: broader })).recipients).toBe(1);
    await admin.mutation(api.mail.campaigns.release, {
        id: broader,
        expectedUpdatedAt: preview.updatedAt,
        recipients: [fresh],
    });
    await backend.mutation(internal.mail.campaigns.batch, { id: broader });
    const messages = await backend.run((ctx) =>
        ctx.db
            .query("messages")
            .withIndex("by_campaign", (q) => q.eq("campaignId", broader))
            .collect(),
    );
    expect(messages.map((row) => row.to)).toEqual(["fresh@example.invalid"]);
});

test("test_deduplicate_announcement_members_without_affecting_other_categories", async () => {
    const { backend, eventId, memberId, subscriptionId } = await announcement();
    await backend.run(async (ctx) => {
        await ctx.db.patch(subscriptionId, { memberId });
        await ctx.db.insert("subscriptions", {
            email: "second@example.invalid",
            memberId,
            status: "subscribed",
            token: "local-test",
            deliveredAt: Date.now(),
            createdAt: 1,
            updatedAt: 1,
        });
    });
    const selected = await backend.run((ctx) =>
        select(ctx, { kind: "subscribers", excludeEventId: eventId }, "announcement"),
    );
    expect(selected.recipients).toEqual([subscriptionId]);
    const unrelated = await backend.run((ctx) => select(ctx, { kind: "subscribers" }, "campaign"));
    expect(unrelated.recipients).toHaveLength(2);
});

test("test_refuse_release_with_unrelated_queued_campaign_or_missing_daily_approval", async () => {
    const { backend, admin, id, subscriptionId } = await announcement();
    const preview = await admin.query(api.mail.campaigns.preview, { id });
    const other = await admin.mutation(api.mail.campaigns.save, {
        subject: "Old launch",
        message: "Old launch",
    });
    await backend.run((ctx) => ctx.db.patch(other, { status: "queued" }));
    const args = { id, expectedUpdatedAt: preview.updatedAt, recipients: [subscriptionId] };
    await expect(admin.mutation(api.mail.campaigns.release, args)).rejects.toThrow(
        "Pause other bulk campaigns",
    );
    await backend.run(async (ctx) => {
        await ctx.db.patch(other, { status: "paused" });
        const policy = (await ctx.db.query("mailPolicy").unique())!;
        await ctx.db.patch(policy._id, { approvedDate: "2000-01-01" });
    });
    await expect(admin.mutation(api.mail.campaigns.release, args)).rejects.toThrow(
        "Approve today's bulk allowance",
    );
});

test("test_filter_series_interest_and_current_registrations_by_identity", async () => {
    const { backend, eventId, memberId, subscriptionId } = await announcement();
    const seriesId = await backend.run(async (ctx) => {
        const seriesId = await ctx.db.insert("series", {
            name: "NLP",
            slug: "nlp",
            description: "",
            topics: [],
            status: "active",
        });
        const event = (await ctx.db.get(eventId))!;
        const { _id, _creationTime, ...fields } = event;
        const past = await ctx.db.insert("events", {
            ...fields,
            seriesId,
            slug: "past",
            startsAt: Date.now() - 86400000,
        });
        await ctx.db.patch(subscriptionId, { memberId });
        await ctx.db.insert("registrations", {
            eventId: past,
            memberId,
            email: "old@example.invalid",
            name: "Test",
            status: "going",
            createdAt: 1,
            updatedAt: 1,
        });
        return seriesId;
    });
    const audience = {
        kind: "subscribers" as const,
        seriesId,
        excludeEventId: eventId,
        deliveredSince: 0,
    };
    expect(await backend.run((ctx) => select(ctx, audience, "announcement"))).toEqual({
        recipients: [subscriptionId],
        excluded: 0,
    });
    await backend.run((ctx) =>
        ctx.db.insert("registrations", {
            eventId,
            memberId,
            email: "new@example.invalid",
            name: "Test",
            status: "waitlist",
            createdAt: 1,
            updatedAt: 1,
        }),
    );
    expect(await backend.run((ctx) => select(ctx, audience, "announcement"))).toEqual({
        recipients: [],
        excluded: 1,
    });
});

test("test_dispatch_active_bulk_without_scanning_paused_or_exhausted_backlogs", async () => {
    const { backend, admin, subscriptionId } = await setup();
    const paused = await admin.mutation(api.mail.campaigns.save, {
        subject: "Paused",
        message: "Paused",
    });
    const active = await admin.mutation(api.mail.campaigns.save, {
        subject: "Active",
        message: "Active",
    });
    const exhausted = await admin.mutation(api.mail.campaigns.save, {
        subject: "Exhausted",
        message: "Exhausted",
    });
    const ids = await backend.run(async (ctx) => {
        await ctx.db.patch(paused, { status: "paused" });
        await ctx.db.patch(active, { status: "queued", attemptLimit: 100, attempts: 0 });
        await ctx.db.patch(exhausted, { status: "queued", attemptLimit: 1, attempts: 1 });
        const held = [];
        for (let index = 0; index < 150; index++) {
            held.push(
                await enqueue(
                    ctx,
                    `held:${index}`,
                    "test@example.invalid",
                    "Held",
                    "Held",
                    subscriptionId,
                    -1000,
                    undefined,
                    { campaignId: paused, category: "campaign" },
                ),
            );
        }
        await enqueue(
            ctx,
            "exhausted",
            "test@example.invalid",
            "Exhausted",
            "Exhausted",
            subscriptionId,
            -1000,
            undefined,
            { campaignId: exhausted, category: "campaign" },
        );
        const ready = await enqueue(
            ctx,
            "ready",
            "test@example.invalid",
            "Ready",
            "Ready",
            subscriptionId,
            0,
            undefined,
            { campaignId: active, category: "announcement" },
        );
        return { held, ready };
    });
    const before = await backend.run((ctx) => ctx.db.get(ids.held[0]));
    await backend.mutation(internal.mail.sending.dispatch, {});
    const scheduled = await backend.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect(),
    );
    expect(scheduled.map((row) => row.args)).toEqual([[{ id: ids.ready }]]);
    expect(await backend.run((ctx) => ctx.db.get(ids.held[0]))).toEqual(before);
    expect((await backend.run((ctx) => ctx.db.get(active)))!.attempts).toBe(0);
    expect((await admin.query(api.mail.sending.current, {})).count).toBe(0);
});

test("test_index_delivery_history_without_changing_consent", async () => {
    const { backend, subscriptionId } = await setup();
    const messageId = await backend.run(async (ctx) => {
        return await enqueue(
            ctx,
            "history",
            "test@example.invalid",
            "Subject",
            "Text",
            subscriptionId,
        );
    });
    await backend.run(async (ctx) => {
        const message = (await ctx.db.get(messageId))!;
        await updateMessage(ctx, message, {
            status: "accepted",
            firstAttemptAt: Date.now(),
            outcome: "delivered",
        });
        await updateMessage(ctx, (await ctx.db.get(messageId))!, { outcome: "failed" });
    });
    await backend.mutation(internal.mail.history.backfill, { cursor: null });
    const row = (await backend.run((ctx) => ctx.db.get(subscriptionId)))!;
    expect(row.status).toBe("subscribed");
    expect(row.hasDeliveryFailure).toBe(true);
    expect(row.deliveredAt).toBeGreaterThan(0);
    expect(
        await backend.run((ctx) =>
            select(ctx, { kind: "subscribers", deliveredSince: 0 }, "announcement"),
        ),
    ).toEqual({ recipients: [], excluded: 1 });
});

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
            isTeam: false,
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

test("test_prioritize_unsent_mail_without_changing_delivery_authorization", async () => {
    const { backend, memberId } = await setup();
    const ids = await backend.run(async (ctx) => {
        const policy = (await ctx.db.query("mailPolicy").unique())!;
        await ctx.db.patch(policy._id, { approvedLimit: 0 });
        const events = [];
        for (const startsAt of [100, 200]) {
            events.push(
                await ctx.db.insert("events", {
                    ownerId: memberId,
                    title: "NLP",
                    slug: `nlp-${startsAt}`,
                    format: "talk",
                    description: "",
                    topics: [],
                    startsAt,
                    location: "Zurich",
                    registration: { kind: "none" },
                    status: "finished",
                    createdAt: 1,
                    updatedAt: 1,
                }),
            );
        }
        const campaignId = await ctx.db.insert("campaigns", {
            subject: "Launch",
            message: "Unchanged",
            status: "queued",
            recipients: [],
            cursor: 0,
            createdAt: 1,
            updatedAt: 1,
        });
        const messages = [];
        for (const [index, name] of [
            "other",
            "older",
            "recent",
            "repeat",
            "cancelled",
            "retry",
            "accepted",
        ].entries()) {
            const email = `${name}@example.invalid`;
            messages.push(
                await ctx.db.insert("messages", {
                    campaignId,
                    key: name,
                    to: email,
                    subject: "Launch",
                    text: "Unchanged",
                    status: name === "accepted" ? "accepted" : "queued",
                    isBulk: true,
                    attempts: ["retry", "accepted"].includes(name) ? 1 : 0,
                    nextAttemptAt: 1000 + index,
                    createdAt: 1,
                }),
            );
            const eventIds =
                name === "repeat"
                    ? [events[0], events[1], events[1]]
                    : ["recent", "cancelled"].includes(name)
                      ? [events[1]]
                      : name === "older"
                        ? [events[0]]
                        : [];
            for (const eventId of eventIds)
                await ctx.db.insert("registrations", {
                    eventId,
                    email: email.toUpperCase(),
                    name,
                    status: name === "cancelled" ? "cancelled" : "going",
                    createdAt: 1,
                    updatedAt: 1,
                });
        }
        return { campaignId, events, messages, policyId: policy._id };
    });
    const before = await backend.run(async (ctx) => ({
        messages: await ctx.db.query("messages").collect(),
        policy: await ctx.db.query("mailPolicy").unique(),
        quota: await ctx.db.query("mailQuota").unique(),
        campaign: await ctx.db.get(ids.campaignId),
    }));

    // preview a deterministic queue without modifying any records
    const ranked = await backend.run(async (ctx) =>
        prioritize(
            before.messages,
            new Map((await ctx.db.query("events").collect()).map((event) => [event._id, event])),
            await ctx.db.query("registrations").collect(),
            new Map(),
        ),
    );
    const preview = ranked.map((row) => ({
        id: row.message._id,
        events: row.events,
        latest: row.latest,
    }));
    expect(preview).toEqual([
        { id: ids.messages[3], events: 2, latest: 200 },
        { id: ids.messages[2], events: 1, latest: 200 },
        { id: ids.messages[1], events: 1, latest: 100 },
        { id: ids.messages[0], events: 0, latest: 0 },
        { id: ids.messages[4], events: 0, latest: 0 },
    ]);
    expect(await backend.run((ctx) => ctx.db.query("messages").collect())).toEqual(before.messages);

    // change only due order, never content, retries, accepted messages or authorization
    const args = {
        campaignId: ids.campaignId,
        messageIds: preview.map((row) => row.id),
        first: 995,
    };
    expect(await backend.mutation(internal.mail.ordering.apply, args)).toBe(5);
    const after = await backend.run(async (ctx) => ({
        messages: await ctx.db.query("messages").collect(),
        policy: await ctx.db.query("mailPolicy").unique(),
        quota: await ctx.db.query("mailQuota").unique(),
        campaign: await ctx.db.get(ids.campaignId),
    }));
    expect(after).toEqual({
        ...before,
        messages: before.messages.map((message) => {
            const index = preview.findIndex((row) => row.id === message._id);
            return index < 0 ? message : { ...message, nextAttemptAt: 995 + index };
        }),
    });

    // reject stale previews and attempts to reorder a running campaign
    await expect(
        backend.mutation(internal.mail.ordering.apply, {
            ...args,
            messageIds: [ids.messages[0], ids.messages[5]],
        }),
    ).rejects.toThrow("Only unattempted queued campaign messages can be reordered.");
    await backend.run((ctx) => ctx.db.patch(ids.policyId, { approvedLimit: 100 }));
    await expect(backend.mutation(internal.mail.ordering.apply, args)).rejects.toThrow(
        "Stop bulk sending before reordering a campaign.",
    );
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

// Import exclusions idempotently without altering quota, policy, or unrelated subscribers.
test("test_import_suppression_without_sending", async () => {
    const { backend, subscriptionId } = await setup();
    const messageId = await backend.run((ctx) =>
        enqueue(
            ctx,
            "excluded",
            "test@example.invalid",
            "Hello",
            "",
            subscriptionId,
            0,
            undefined,
            { category: "campaign" },
        ),
    );
    const args = {
        emails: [" TEST@example.invalid ", "test@example.invalid", "missing@example.invalid"],
        source: "wix:bounced",
        isDryRun: true,
    };
    await expect(backend.mutation(internal.mail.subscriptions.suppress, args)).rejects.toThrow(
        "Pause bulk sending before importing exclusions.",
    );
    await backend.run(async (ctx) => {
        const policy = await ctx.db.query("mailPolicy").unique();
        await ctx.db.patch(policy!._id, { isPaused: true });
    });

    // capture all state affected by the sender before the dry run
    const snapshot = () =>
        backend.run(async (ctx) => ({
            subscriptions: await ctx.db.query("subscriptions").collect(),
            policy: await ctx.db.query("mailPolicy").collect(),
            quota: await ctx.db.query("mailQuota").collect(),
            messages: await ctx.db.query("messages").collect(),
        }));
    const before = await snapshot();
    expect(await backend.mutation(internal.mail.subscriptions.suppress, args)).toEqual({
        total: 2,
        changed: 2,
        unchanged: 0,
    });
    expect(await snapshot()).toEqual(before);

    // retain the original subscription fields and append attributed suppression history
    expect(
        await backend.mutation(internal.mail.subscriptions.suppress, {
            ...args,
            isDryRun: false,
        }),
    ).toEqual({ total: 2, changed: 2, unchanged: 0 });
    const after = await snapshot();
    const row = after.subscriptions.find((row) => row._id === subscriptionId)!;
    expect(row).toEqual({
        ...before.subscriptions[0],
        status: "suppressed",
        updatedAt: row.updatedAt,
        history: [
            { at: 1, status: "subscribed", weekly: true, source: "account", isEstimated: true },
            { at: row.updatedAt, status: "suppressed", weekly: true, source: "wix:bounced" },
        ],
    });
    expect(after.policy).toEqual(before.policy);
    expect(after.quota).toEqual(before.quota);
    expect(after.messages).toEqual(before.messages);
    expect(await backend.query(internal.mail.messages.read, { id: messageId })).toBeNull();

    // repeat the import without changing history or timestamps
    expect(
        await backend.mutation(internal.mail.subscriptions.suppress, {
            ...args,
            isDryRun: false,
        }),
    ).toEqual({ total: 2, changed: 0, unchanged: 2 });
    expect(await snapshot()).toEqual(after);
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

test("test_exclude_suppressed_contacts_from_public_history_without_erasing_opt_outs", async () => {
    setSystemTime(new Date("2026-09-29T12:00:00Z"));
    const { backend, subscriptionId } = await setup();
    const joined = Date.parse("2026-08-01T12:00:00Z");
    const left = Date.parse("2026-09-10T12:00:00Z");
    const suppressed = Date.parse("2026-09-28T12:00:00Z");

    // retain one current member and one genuine opt-out alongside historical suppressions
    await backend.run(async (ctx) => {
        await ctx.db.patch(subscriptionId, {
            createdAt: joined,
            history: [{ at: joined, status: "subscribed", weekly: true, source: "test" }],
        });
        for (const status of ["unsubscribed", "suppressed"] as const) {
            await ctx.db.insert("subscriptions", {
                email: `${status}@example.invalid`,
                token: status,
                status,
                createdAt: joined,
                updatedAt: status === "suppressed" ? suppressed : left,
                history: [
                    { at: joined, status: "subscribed", weekly: true, source: "test" },
                    {
                        at: status === "suppressed" ? suppressed : left,
                        status,
                        weekly: true,
                        source: "test",
                    },
                ],
            });
        }
        await ctx.db.insert("subscriptions", {
            email: "legacy-suppressed@example.invalid",
            token: "legacy-suppressed",
            status: "suppressed",
            createdAt: joined,
            updatedAt: suppressed,
        });
    });

    // reconstruct the same eligible population across the entire chart and monthly growth
    const stats = await backend.query(api.statistics.queries.community, {});
    expect(await backend.query(api.statistics.queries.subscribers, {})).toBe(1);
    expect(stats.totals.subscribers).toBe(1);
    expect(stats.history.subscribers).toEqual([
        { date: "2026-08-01", value: 2, isEstimated: false },
        { date: "2026-09-10", value: 1, isEstimated: false },
        { date: "2026-09-29", value: 1 },
    ]);
    expect(stats.growth.subscribers).toEqual({
        value: -1,
        since: "2026-08-30",
        isEstimated: false,
    });

    // leave delivery suppressions and their audit history untouched
    const excluded = await backend.run((ctx) =>
        ctx.db
            .query("subscriptions")
            .withIndex("by_status", (q) => q.eq("status", "suppressed"))
            .collect(),
    );
    expect(excluded.length).toBe(2);
    expect(excluded.find((row) => row.token === "suppressed")?.history).toEqual([
        { at: joined, status: "subscribed", weekly: true, source: "test" },
        { at: suppressed, status: "suppressed", weekly: true, source: "test" },
    ]);
});
