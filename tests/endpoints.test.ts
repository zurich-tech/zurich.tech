import { convexTest, schema, modules, member } from "./backend";
import { expect, test } from "bun:test";
import { api } from "../convex/_generated/api";
import { revisionFields } from "../convex/events/fields";
import { canSend } from "../convex/mail/access";
import { requireCompany } from "../convex/organisations/mutations";

async function setup() {
    const backend = convexTest(schema, modules);
    const ids = await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Test",
            searchText: "test",
            visibility: "private",
        });
        const accountId = await ctx.db.insert("accounts", {
            authId: "editor",
            memberId,
            status: "active",
            isTeam: false,
            isAdmin: false,
            createdAt: 1,
            updatedAt: 1,
        });
        const seriesId = await ctx.db.insert("series", {
            slug: "dinners",
            name: "Dinners",
            description: "",
            topics: [],
            status: "active",
        });
        const otherSeries = await ctx.db.insert("series", {
            slug: "other",
            name: "Other",
            description: "",
            topics: [],
            status: "active",
        });
        const values = {
            title: "Dinner",
            slug: "dinner",
            format: "dinner" as const,
            description: "Original",
            topics: [],
            startsAt: Date.now() + 86400000,
            location: "Venue",
            registration: { kind: "none" as const },
            ownerId: memberId,
            status: "scheduled" as const,
            createdAt: 1,
            updatedAt: 1,
        };
        const eventId = await ctx.db.insert("events", { ...values, seriesId });
        const otherId = await ctx.db.insert("events", {
            ...values,
            slug: "other",
            seriesId: otherSeries,
        });
        const draftId = await ctx.db.insert("submissions", {
            title: values.title,
            slug: values.slug,
            description: values.description,
            topics: [],
            format: values.format,
            startsAt: values.startsAt,
            location: values.location,
            registration: values.registration,
            ownerId: memberId,

            seriesId,
            eventId,
            status: "published",
            updatedAt: 1,
            organisations: [],
            speakers: [],
            agenda: [],
        });
        const grantId = await ctx.db.insert("accessGrants", {
            accountId,
            role: "editor",
            scope: { kind: "event", id: eventId },
            updatedAt: 1,
        });
        return { memberId, accountId, seriesId, otherSeries, eventId, otherId, draftId, grantId };
    });
    return { backend, editor: backend.withIdentity({ subject: "editor" }), ids };
}

test("test_allow_team_content_without_attendee_financial_or_admin_access", async () => {
    const { backend, editor, ids } = await setup();
    await backend.run(async (ctx) => {
        await ctx.db.patch(ids.accountId, { isTeam: true });
        await ctx.db.delete(ids.grantId);
    });
    const access = await editor.query(api.auth.queries.current, {});
    expect(access.canManage).toBe(true);
    expect(access.canSendMail).toBe(false);
    expect(access.organisedEventIds).toEqual([]);
    const workspace = await editor.query(api.events.management.workspace, {});
    expect(workspace.counts).toEqual([]);
    expect(workspace.organiserEventIds).toEqual([]);
    expect(workspace.published.map((event) => event._id)).toEqual([ids.otherId]);
    await editor.mutation(api.events.mutations.edit, { eventId: ids.otherId });
    await editor.mutation(api.topics.queries.save, {
        slug: "robotics",
        name: "Robotics",
        isActive: true,
    });
    await expect(editor.query(api.news.queries.workspace, {})).resolves.toBeDefined();
    await expect(
        editor.query(api.events.registrations.list, { eventId: ids.eventId }),
    ).rejects.toThrow("You do not have access to this event.");
    await expect(editor.query(api.auth.management.list, {})).rejects.toThrow(
        "Admin access is required.",
    );
    await expect(
        editor.mutation(api.auth.management.setPermission, {
            id: ids.accountId,
            permission: "isMailSender",
            isEnabled: true,
        }),
    ).rejects.toThrow("Admin access is required.");

    // directory creation must not implicitly confer ownership or financial access
    const fields = {
        name: "Test Lab",
        kind: "company" as const,
        slug: "test-lab",
        website: "https://example.com",
        location: "Zurich",
        description: "Research",
    };
    const organisationId = await editor.mutation(api.organisations.mutations.upsertCompany, fields);
    expect((await backend.run((ctx) => ctx.db.get(organisationId)))?.ownerId).toBeUndefined();
    await editor.mutation(api.organisations.mutations.upsertCompany, {
        ...fields,
        id: organisationId,
        name: "Updated Lab",
    });
    await expect(editor.run((ctx) => requireCompany(ctx, organisationId))).rejects.toThrow(
        "You cannot manage this company.",
    );
    await expect(
        editor.mutation(api.organisations.mutations.upsertCompany, {
            ...fields,
            id: organisationId,
            ownerEmail: "owner@example.com",
        }),
    ).rejects.toThrow("Admin access is required to assign a company.");
    const directory = await editor.query(api.organisations.workspace.employer, { directory: true });
    expect(directory.organisations.map((organisation) => organisation._id)).toEqual([
        organisationId,
    ]);
    expect(directory.jobs).toEqual([]);
    expect(directory.sponsorships).toEqual([]);
    expect(directory.owners).toEqual([]);
    expect((await editor.query(api.organisations.workspace.employer, {})).organisations).toEqual(
        [],
    );

    // manage public organisation locations, never another member's private locations
    const address = {
        name: "Office",
        line1: "Example 1",
        locality: "Zurich",
        countryCode: "CH",
        latitude: 47.37,
        longitude: 8.54,
    };
    const locationId = await editor.mutation(api.places.locations.save, {
        ...address,
        ownerId: organisationId,
    });
    expect(
        (await editor.query(api.places.locations.list, { ownerId: organisationId })).map(
            (location) => location._id,
        ),
    ).toEqual([locationId]);
    await editor.mutation(api.places.locations.remove, { id: locationId });
    expect(await editor.query(api.places.locations.list, { ownerId: organisationId })).toEqual([]);
    const privateMemberId = await backend.run((ctx) =>
        member(ctx, { name: "Private", searchText: "private", visibility: "private" }),
    );
    await expect(
        editor.query(api.places.locations.list, { ownerId: privateMemberId }),
    ).rejects.toThrow("You cannot manage this location.");
    await expect(
        editor.mutation(api.places.locations.save, { ...address, ownerId: privateMemberId }),
    ).rejects.toThrow("You cannot manage this location.");

    // removing team membership immediately removes directory and unrelated draft access
    await backend.run((ctx) => ctx.db.patch(ids.accountId, { isTeam: false }));
    await expect(
        editor.mutation(api.organisations.mutations.upsertCompany, {
            ...fields,
            id: organisationId,
        }),
    ).rejects.toThrow("You cannot manage this organisation.");
    await expect(
        editor.mutation(api.events.mutations.edit, { eventId: ids.otherId }),
    ).rejects.toThrow("You do not have access to this event.");
});

test("test_require_explicit_email_permission_even_for_event_organisers", async () => {
    const { backend, editor, ids } = await setup();
    await backend.run((ctx) => ctx.db.patch(ids.grantId, { role: "organiser" }));
    const campaignId = await editor.mutation(api.mail.campaigns.save, {
        subject: "Update",
        message: "Hello",
        audience: { kind: "registrations", eventId: ids.eventId, status: "active" },
    });
    await expect(
        editor.mutation(api.mail.campaigns.queue, {
            id: campaignId,
            expectedUpdatedAt: 0,
            expectedRecipients: 0,
        }),
    ).rejects.toThrow("Email sending permission is required.");
    await expect(editor.mutation(api.mail.campaigns.test, { id: campaignId })).rejects.toThrow(
        "Email sending permission is required.",
    );
    await expect(
        editor.mutation(api.mail.campaigns.pause, { id: campaignId, isPaused: false }),
    ).rejects.toThrow("Email sending permission is required.");
    await expect(
        editor.mutation(api.events.mail.send, {
            eventId: ids.eventId,
            kind: "reminder",
            receipt: "forged",
        }),
    ).rejects.toThrow("Email sending permission is required.");
    await expect(
        editor.mutation(api.events.mutations.cancel, { eventId: ids.eventId, receipt: "forged" }),
    ).rejects.toThrow("Email sending permission is required.");

    // sender permission never grants event scope or global subscriber access
    await backend.run((ctx) => ctx.db.patch(ids.accountId, { isMailSender: true }));
    const campaign = (await backend.run((ctx) => ctx.db.get(campaignId)))!;
    expect(await backend.run((ctx) => canSend(ctx, campaign))).toBe(true);
    await expect(
        editor.mutation(api.events.mail.send, {
            eventId: ids.otherId,
            kind: "reminder",
            receipt: "forged",
        }),
    ).rejects.toThrow("You do not have access to this event.");
    await expect(
        editor.mutation(api.events.mail.send, {
            eventId: ids.eventId,
            kind: "announcement",
            receipt: "forged",
        }),
    ).rejects.toThrow("Admin access is required.");
    await expect(editor.query(api.mail.campaigns.list, {})).rejects.toThrow(
        "Admin access is required.",
    );

    // recheck both independent permission and event assignment before queued delivery
    await backend.run((ctx) => ctx.db.patch(ids.accountId, { isMailSender: false }));
    expect(await backend.run((ctx) => canSend(ctx, campaign))).toBe(false);
    await backend.run(async (ctx) => {
        await ctx.db.patch(ids.accountId, { isMailSender: true });
        await ctx.db.delete(ids.grantId);
    });
    expect(await backend.run((ctx) => canSend(ctx, campaign))).toBe(false);
    expect(await backend.run((ctx) => ctx.db.query("messages").collect())).toEqual([]);
});

test("test_allow_team_email_drafts_without_sending_or_recipient_records", async () => {
    process.env.SITE_URL ||= "https://example.invalid";
    const { backend, editor, ids } = await setup();
    await backend.run(async (ctx) => {
        await ctx.db.patch(ids.accountId, { isTeam: true, isMailSender: true });
        await ctx.db.delete(ids.grantId);
    });
    const id = await editor.mutation(api.mail.campaigns.save, {
        subject: "Update",
        message: "Hello",
        audience: { kind: "registrations", eventId: ids.otherId, status: "active" },
    });
    const messageId = await backend.run((ctx) =>
        ctx.db.insert("messages", {
            campaignId: id,
            key: "private-recipient",
            to: "private@example.invalid",
            subject: "Update",
            text: "Hello",
            status: "accepted",
            isBulk: true,
            nextAttemptAt: 1,
            attempts: 1,
            createdAt: 1,
        }),
    );
    expect((await editor.query(api.mail.campaigns.preview, { id })).messages).toEqual([]);
    await expect(
        editor.mutation(api.mail.campaigns.queue, {
            id,
            expectedUpdatedAt: 0,
            expectedRecipients: 0,
        }),
    ).rejects.toThrow("You do not have access to this event.");
    expect(
        await backend.run(async (ctx) =>
            (await ctx.db.query("messages").collect()).map((message) => message._id),
        ),
    ).toEqual([messageId]);
});

test("test_roundtrip_expanded_education_and_preserve_existing_answers", async () => {
    const { editor } = await setup();
    for (const education of [
        "none",
        "compulsory",
        "upper-secondary",
        "professional",
        "secondary",
        "vocational",
        "bachelor",
        "master",
        "doctorate",
        "other",
    ] as const) {
        const answers = {
            demographics: { education },
            interests: [],
            motivations: [],
            participation: [],
        };
        await editor.mutation(api.members.audience.save, answers);
        const saved = await editor.query(api.members.audience.current, {});
        expect(saved.demographics).toEqual({ education });
    }
});

test("test_show_member_emails_only_in_the_administrator_access_directory", async () => {
    const { backend, editor, ids } = await setup();
    await backend.run(async (ctx) => {
        for (const [email, isPrimary] of [
            ["alias@example.invalid", false],
            ["primary@example.invalid", true],
        ] as const) {
            await ctx.db.insert("emails", {
                memberId: ids.memberId,
                email,
                isPrimary,
                createdAt: 1,
                updatedAt: 1,
            });
        }
    });
    await expect(editor.query(api.auth.management.list, {})).rejects.toThrow(
        "Admin access is required.",
    );

    await backend.run((ctx) => ctx.db.patch(ids.accountId, { isAdmin: true }));
    const directory = await editor.query(api.auth.management.list, {});
    expect(directory.people.map(({ id, name, emails }) => ({ id, name, emails }))).toEqual([
        {
            id: ids.accountId,
            name: "Test",
            emails: ["primary@example.invalid", "alias@example.invalid"],
        },
    ]);
});

test("test_audit_independent_team_and_email_permissions", async () => {
    const { backend, editor, ids } = await setup();
    await backend.run((ctx) => ctx.db.patch(ids.accountId, { isAdmin: true }));
    await editor.mutation(api.auth.management.setPermission, {
        id: ids.accountId,
        permission: "isTeam",
        isEnabled: true,
    });
    await editor.mutation(api.auth.management.setPermission, {
        id: ids.accountId,
        permission: "isMailSender",
        isEnabled: true,
    });
    const changes = await backend.run((ctx) => ctx.db.query("accessChanges").collect());
    expect(
        changes.map(({ actorId, accountId, action, detail }) => ({
            actorId,
            accountId,
            action,
            detail,
        })),
    ).toEqual([
        { actorId: ids.accountId, accountId: ids.accountId, action: "isTeam", detail: "true" },
        {
            actorId: ids.accountId,
            accountId: ids.accountId,
            action: "isMailSender",
            detail: "true",
        },
    ]);
});

test("workspace exposes only the assigned event and no account directory", async () => {
    const { editor, ids } = await setup();
    const result = await editor.query(api.events.management.workspace, { editor: true });
    expect(result.submissions.map((row) => row.eventId)).toEqual([ids.eventId]);
    expect(result.published).toEqual([]);
    expect(result.counts).toEqual([]);
    expect(result).not.toHaveProperty("people");
    expect(result).not.toHaveProperty("digest");
});

test("editor cannot publish, send, manage attendees or grant access", async () => {
    const { editor, ids } = await setup();
    await expect(editor.query(api.events.mail.preview, { eventId: ids.eventId })).rejects.toThrow();
    await expect(
        editor.query(api.events.registrations.list, { eventId: ids.eventId }),
    ).rejects.toThrow();
    await expect(
        editor.mutation(api.events.mutations.unpublish, {
            eventId: ids.eventId,
            receipt: "forged",
        }),
    ).rejects.toThrow();
    await expect(
        editor.mutation(api.auth.management.setAdmin, { id: ids.accountId, isAdmin: true }),
    ).rejects.toThrow();
    await expect(
        editor.mutation(api.events.mutations.edit, { eventId: ids.otherId }),
    ).rejects.toThrow();
});

test("series organisers inherit only their series and revocation applies immediately", async () => {
    const { backend, editor, ids } = await setup();
    await backend.run((ctx) =>
        ctx.db.patch(ids.grantId, {
            role: "organiser",
            scope: { kind: "series", id: ids.seriesId },
        }),
    );
    await expect(
        editor.query(api.events.registrations.list, { eventId: ids.eventId }),
    ).resolves.toBeDefined();
    await expect(
        editor.query(api.events.registrations.list, { eventId: ids.otherId }),
    ).rejects.toThrow();
    await backend.run((ctx) => ctx.db.delete(ids.grantId));
    await expect(editor.query(api.events.management.workspace, {})).rejects.toThrow();
});

test("team membership does not grant administrative authority", async () => {
    const { backend, editor, ids } = await setup();
    await backend.run((ctx) => ctx.db.patch(ids.accountId, { isTeam: true, isAdmin: true }));
    await expect(editor.query(api.auth.management.list, {})).resolves.toBeDefined();
    await backend.run((ctx) => ctx.db.patch(ids.accountId, { isAdmin: false }));
    await expect(editor.query(api.auth.management.list, {})).rejects.toThrow();
});

test("disabled accounts lose authority even with existing grants", async () => {
    const { backend, editor, ids } = await setup();
    await backend.run((ctx) => ctx.db.patch(ids.accountId, { status: "disabled", isAdmin: true }));
    await expect(editor.query(api.events.management.workspace, {})).rejects.toThrow();
});

test("test_enable_followup_after_event_only_when_send_time_is_future", async () => {
    const { backend, editor, ids } = await setup();
    const draft = await backend.run((ctx) => ctx.db.get(ids.draftId));
    const fields = {
        ...revisionFields(draft!),
        id: ids.draftId,
        startsAt: Date.now() - 4 * 3600000,
        endsAt: Date.now() - 2 * 3600000,
        registration: {
            kind: "native" as const,
            admission: "automatic" as const,
            capacity: null,
            overflow: "waitlist" as const,
            questions: [],
        },
    };
    await editor.mutation(api.events.mutations.save, {
        ...fields,
        followUp: { isEnabled: true, delayHours: 12 },
    });
    await expect(
        editor.mutation(api.events.mutations.save, {
            ...fields,
            followUp: { isEnabled: true, delayHours: 1 },
        }),
    ).rejects.toThrow("Choose a future send time before enabling follow-up.");
    expect((await backend.run((ctx) => ctx.db.get(ids.eventId)))?.followUp).toBeUndefined();
    expect(await backend.run((ctx) => ctx.db.query("messages").collect())).toEqual([]);
});

test("saving a published-event draft changes neither the live event nor email queue", async () => {
    const { backend, editor, ids } = await setup();
    const draft = await backend.run((ctx) => ctx.db.get(ids.draftId));
    const fields = revisionFields(draft!);
    await editor.mutation(api.events.mutations.save, {
        ...fields,
        id: ids.draftId,

        description: "Revised",
        publish: false,
    });
    await backend.run(async (ctx) => {
        expect((await ctx.db.get(ids.eventId))?.description).toBe("Original");
        expect((await ctx.db.get(ids.draftId))?.description).toBe("Revised");
        expect(await ctx.db.query("messages").collect()).toEqual([]);
    });
    await expect(
        editor.mutation(api.events.mutations.save, {
            ...fields,
            id: ids.draftId,

            publish: true,
            receipt: "forged",
        }),
    ).rejects.toThrow();
    await expect(
        editor.mutation(api.events.mutations.save, {
            ...fields,
            id: ids.draftId,
            seriesId: ids.otherSeries,

            publish: false,
        }),
    ).rejects.toThrow();
});

test("series editor revisions stay private until an organiser publishes", async () => {
    const { backend, editor, ids } = await setup();
    await backend.run((ctx) =>
        ctx.db.patch(ids.grantId, { scope: { kind: "series", id: ids.seriesId } }),
    );
    const fields = {
        id: ids.seriesId,
        name: "Revised dinners",
        slug: "dinners",
        description: "Draft",
        topics: [],
    };
    await editor.mutation(api.events.series.upsert, { ...fields, publish: false });
    expect((await backend.run((ctx) => ctx.db.get(ids.seriesId)))?.name).toBe("Dinners");
    expect((await editor.query(api.events.series.workspace, {}))[0].name).toBe("Revised dinners");
    await expect(
        editor.mutation(api.events.series.upsert, { ...fields, publish: true }),
    ).rejects.toThrow();
    await backend.run((ctx) => ctx.db.patch(ids.grantId, { role: "organiser" }));
    await editor.mutation(api.events.series.upsert, { ...fields, publish: true });
    expect((await backend.run((ctx) => ctx.db.get(ids.seriesId)))?.name).toBe("Revised dinners");
});

test("admins cannot remove their own admin access and assignments are audited", async () => {
    const { backend, editor, ids } = await setup();
    await backend.run((ctx) => ctx.db.patch(ids.accountId, { isAdmin: true }));
    await expect(
        editor.mutation(api.auth.management.setAdmin, { id: ids.accountId, isAdmin: false }),
    ).rejects.toThrow();
    await editor.mutation(api.auth.management.setGrant, {
        accountId: ids.accountId,
        scope: { kind: "event", id: ids.eventId },
        role: "organiser",
    });
    const changes = await backend.run((ctx) => ctx.db.query("accessChanges").collect());
    expect(changes.length).toBe(1);
    expect(changes[0].actorId).toBe(ids.accountId);
});

test("deleting an unused draft removes its scoped assignments", async () => {
    const { backend, editor, ids } = await setup();
    await backend.run(async (ctx) => {
        await ctx.db.patch(ids.accountId, { isAdmin: true });
        await ctx.db.patch(ids.eventId, { status: "draft" });
    });
    await editor.mutation(api.events.deletions.remove, { id: ids.draftId });
    await backend.run(async (ctx) => {
        expect(await ctx.db.get(ids.eventId)).toBeNull();
        expect(await ctx.db.get(ids.grantId)).toBeNull();
        expect(await ctx.db.get(ids.otherId)).not.toBeNull();
    });
});

test("a new draft gets an assignable event identity without publication or mail", async () => {
    const { backend, editor, ids } = await setup();
    await backend.run((ctx) => ctx.db.patch(ids.accountId, { isAdmin: true }));
    const draft = await backend.run((ctx) => ctx.db.get(ids.draftId));
    const fields = revisionFields(draft!);
    await editor.mutation(api.events.mutations.save, {
        ...fields,
        slug: "new-draft",

        publish: false,
    });
    await backend.run(async (ctx) => {
        const event = await ctx.db
            .query("events")
            .filter((q) => q.eq(q.field("slug"), "new-draft"))
            .unique();
        expect(event?.status).toBe("draft");
        const revision = await ctx.db
            .query("submissions")
            .withIndex("by_event", (q) => q.eq("eventId", event!._id))
            .unique();
        expect(revision).not.toBeNull();
        expect(await ctx.db.query("messages").collect()).toEqual([]);
    });
});

// exercise inheritance, explicit overrides, privacy and authority through public queries
test("test_resolve_public_organisers_without_granting_access", async () => {
    const { backend, editor, ids } = await setup();
    const second = await backend.run(async (ctx) => {
        await ctx.db.patch(ids.memberId, {
            visibility: "public",
            headline: "Researcher at Test Lab",
        });
        await ctx.db.insert("handles", {
            memberId: ids.memberId,
            name: "first",
            status: "active",
            createdAt: 1,
            updatedAt: 1,
        });
        const memberId = await member(ctx, {
            name: "Second",
            searchText: "second",
            visibility: "public",
        });
        await ctx.db.insert("handles", {
            memberId,
            name: "second",
            status: "active",
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.patch(ids.seriesId, { primaryOrganiserId: ids.memberId });
        await ctx.db.delete(ids.grantId);
        return memberId;
    });
    const row = await backend.run((ctx) => ctx.db.get(ids.eventId));
    const read = () => backend.query(api.events.queries.event, { slug: row!.slug });
    expect((await read())?.organiser?.name).toBe("Test");
    expect((await read())?.organiser?.headline).toBe("Researcher at Test Lab");
    await expect(
        editor.mutation(api.events.mutations.edit, { eventId: ids.eventId }),
    ).rejects.toThrow();
    await backend.run((ctx) => ctx.db.patch(ids.eventId, { primaryOrganiserId: second }));
    expect((await read())?.organiser?.name).toBe("Second");
    await backend.run((ctx) => ctx.db.patch(second, { visibility: "private" }));
    expect((await read())?.organiser).toBeNull();
    await backend.run((ctx) => ctx.db.patch(ids.eventId, { primaryOrganiserId: undefined }));
    expect((await read())?.organiser?.name).toBe("Test");
});

// Address and coordinates must travel together through public and private entry points.
test("private addresses follow current confirmation and scoped editing access", async () => {
    const { backend, editor, ids } = await setup();
    const registrationId = await backend.run(async (ctx) => {
        await ctx.db.patch(ids.eventId, {
            address: "Private street 42",
            latitude: 47.3,
            longitude: 8.5,
            addressAccess: { kind: "confirmed" },
            registration: {
                kind: "native",
                admission: "approval",
                capacity: 20,
                overflow: "waitlist",
                questions: [],
            },
        });
        return await ctx.db.insert("registrations", {
            eventId: ids.eventId,
            name: "Guest",
            email: "guest@example.invalid",
            status: "pending",
            token: "private-pass",
            createdAt: 1,
            updatedAt: 1,
        });
    });
    const publicEvent = await backend.query(api.events.queries.event, { slug: "dinner" });
    expect(JSON.stringify(publicEvent)).not.toContain("Private street");
    expect(publicEvent?.venue.coordinates).toBeUndefined();
    expect((await editor.query(api.events.place.get, { eventId: ids.eventId }))?.address).toBe(
        "Private street 42",
    );
    await backend.run((ctx) => ctx.db.delete(ids.grantId));
    expect(
        (await editor.query(api.events.place.get, { eventId: ids.eventId }))?.address,
    ).toBeUndefined();

    for (const status of ["pending", "waitlist", "going", "cancelled", "declined"] as const) {
        await backend.run((ctx) => ctx.db.patch(registrationId, { status }));
        const venue = await backend.query(api.events.place.get, {
            eventId: ids.eventId,
            token: "private-pass",
        });
        const ticket = await backend.query(api.events.registrations.get, { token: "private-pass" });
        expect(!!venue?.address).toBe(status === "going");
        expect(!!venue?.coordinates).toBe(status === "going");
        expect(!!ticket?.venue.address).toBe(status === "going");
    }
    expect(
        (await backend.query(api.events.place.get, { eventId: ids.otherId, token: "private-pass" }))
            ?.address,
    ).toBeUndefined();
    await backend.run((ctx) =>
        ctx.db.patch(ids.eventId, {
            addressAccess: { kind: "external", url: "https://luma.com/example", label: "Luma" },
        }),
    );
    const external = await backend.query(api.events.queries.event, { slug: "dinner" });
    expect(external?.venue.label).toBe("Luma");
    expect(external?.venue.address).toBeUndefined();
});

test("public email rendering never includes a confirmed-only address", async () => {
    process.env.SITE_URL ||= "https://example.invalid";
    const { eventEmail, eventChanges } = await import("../convex/mail/templates");
    const event = {
        title: "Private dinner",
        slug: "private-dinner",
        startsAt: Date.now(),
        address: "SECRET ADDRESS",
        addressAccess: { kind: "confirmed" as const },
    };
    expect(JSON.stringify(eventEmail(event, "Event updated"))).not.toContain("SECRET ADDRESS");
    expect(eventChanges({ ...event, address: "OLD SECRET" }, event)).not.toContain("SECRET");
});

// Public credits inherit independently, preserve ordering and never grant editing rights.
test("co-organisers inherit, deduplicate, override and respect profile privacy", async () => {
    const { backend, editor, ids } = await setup();
    const coId = await backend.run(async (ctx) => {
        await ctx.db.patch(ids.memberId, { visibility: "public" });
        await ctx.db.insert("handles", {
            memberId: ids.memberId,
            name: "main-host",
            status: "active",
            createdAt: 1,
            updatedAt: 1,
        });
        const memberId = await member(ctx, {
            name: "Co-host",
            searchText: "co-host",
            visibility: "public",
        });
        await ctx.db.insert("handles", {
            memberId,
            name: "co-host",
            status: "active",
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.patch(ids.seriesId, {
            primaryOrganiserId: ids.memberId,
            coOrganiserIds: [ids.memberId, memberId],
        });
        await ctx.db.delete(ids.grantId);
        return memberId;
    });
    const read = () => backend.query(api.events.queries.event, { slug: "dinner" });
    expect((await read())?.coOrganisers.map((person) => person.name)).toEqual(["Co-host"]);
    expect(
        (await backend.query(api.events.queries.calendar, {}))
            .find((event) => event.id === ids.eventId)
            ?.coOrganisers.map((person) => person.name),
    ).toEqual(["Co-host"]);
    await expect(
        editor.mutation(api.events.mutations.edit, { eventId: ids.eventId }),
    ).rejects.toThrow();
    await backend.run((ctx) => ctx.db.patch(ids.eventId, { coOrganiserIds: [] }));
    expect((await read())?.coOrganisers).toEqual([]);
    await backend.run((ctx) =>
        ctx.db.patch(ids.eventId, { coOrganiserIds: undefined, primaryOrganiserId: coId }),
    );
    expect((await read())?.coOrganisers.map((person) => person.name)).toEqual(["Test"]);
    await backend.run((ctx) => ctx.db.patch(ids.memberId, { visibility: "private" }));
    expect((await read())?.coOrganisers).toEqual([]);
});

// Recurrence publishes stored templates directly, bypassing the editor save mutation.
test("publication validates private address policy on stored revisions", async () => {
    const { backend, ids } = await setup();
    const { publishEvent } = await import("../convex/events/mutations");
    await backend.run((ctx) =>
        ctx.db.patch(ids.draftId, {
            addressAccess: { kind: "confirmed" },
        }),
    );
    await expect(backend.run((ctx) => publishEvent(ctx, ids.draftId))).rejects.toThrow(
        "Confirmed-only addresses require registration on zurich.tech.",
    );
    await backend.run((ctx) =>
        ctx.db.patch(ids.draftId, {
            registration: {
                kind: "native",
                admission: "automatic",
                capacity: null,
                overflow: "waitlist",
                questions: [],
            },
        }),
    );
    await expect(backend.run((ctx) => publishEvent(ctx, ids.draftId))).rejects.toThrow(
        "Add the address for confirmed attendees before publishing.",
    );
});

// preserve explicit speaker assignments through publication and revision editing
test("programme speaker assignments survive editing", async () => {
    const { backend, editor, ids } = await setup();
    await backend.run(async (ctx) => {
        await ctx.db.patch(ids.memberId, { visibility: "public" });
        await ctx.db.insert("handles", {
            memberId: ids.memberId,
            name: "host",
            status: "active",
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.patch(ids.seriesId, { primaryOrganiserId: ids.memberId });
        await ctx.db.delete(ids.draftId);
        const speakerId = await ctx.db.insert("speakers", {
            eventId: ids.eventId,
            name: "Test",
            position: 0,
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.insert("sessions", {
            eventId: ids.eventId,
            title: "Building computer-use agents",
            time: "18:30",
            speakerIds: [speakerId],
            position: 0,
            createdAt: 1,
            updatedAt: 1,
        });
    });
    const event = await backend.query(api.events.queries.event, { slug: "dinner" });
    expect(event!.agenda[0].speakerIds).toEqual([event!.speakers[0].id]);
    const draftId = await editor.mutation(api.events.mutations.edit, { eventId: ids.eventId });
    const draft = await backend.run((ctx) => ctx.db.get(draftId));
    expect(draft!.agenda[0].title).toBe("Building computer-use agents");
    expect(draft!.agenda[0].speakerPositions).toEqual([0]);
    const { publishEvent } = await import("../convex/events/mutations");
    await backend.run((ctx) => publishEvent(ctx, draftId));
    const published = await backend.query(api.events.queries.event, { slug: "dinner" });
    expect(published!.agenda[0].speakerIds).toEqual([published!.speakers[0].id]);
    await editor.mutation(api.events.mutations.save, {
        ...revisionFields(draft!),
        id: draftId,
        agenda: [{ title: "Panel", time: "", speakerPositions: [] }],
    });
    await backend.run((ctx) => publishEvent(ctx, draftId));
    expect(
        (await backend.query(api.events.queries.event, { slug: "dinner" }))!.agenda[0].speakerIds,
    ).toEqual([]);
    for (const positions of [[1], [-1], [0, 0], [0.5]]) {
        await expect(
            editor.mutation(api.events.mutations.save, {
                ...revisionFields(draft!),
                id: draftId,
                agenda: [{ title: "Panel", time: "", speakerPositions: positions }],
            }),
        ).rejects.toThrow("programme speakers must belong to this event");
    }
});

test("speaker portraits inherit only from public profiles", async () => {
    const { backend, ids } = await setup();
    const speakerId = await backend.run(async (ctx) => {
        await ctx.db.patch(ids.memberId, {
            visibility: "public",
            avatarUrl: "https://example.com/member.jpg",
        });
        await ctx.db.insert("handles", {
            memberId: ids.memberId,
            name: "speaker",
            status: "active",
            createdAt: 1,
            updatedAt: 1,
        });
        return await ctx.db.insert("speakers", {
            eventId: ids.eventId,
            memberId: ids.memberId,
            name: "Test",
            position: 0,
            createdAt: 1,
            updatedAt: 1,
        });
    });
    const read = async () =>
        (await backend.query(api.events.queries.event, { slug: "dinner" }))!.speakers[0];
    expect((await read()).imageUrl).toBe("https://example.com/member.jpg");
    await backend.run((ctx) => ctx.db.patch(ids.memberId, { visibility: "private" }));
    expect((await read()).imageUrl).toBeUndefined();
    await backend.run((ctx) =>
        ctx.db.patch(speakerId, { imageUrl: "https://example.com/appearance.jpg" }),
    );
    expect((await read()).imageUrl).toBe("https://example.com/appearance.jpg");
});

// Public profile changes may flow through credits; event overrides remain historical facts.
test("speaker affiliations inherit privately and preserve explicit overrides", async () => {
    const { backend, ids } = await setup();
    const current = [{ role: "Researcher", organisation: "Current University" }];
    const historical = [{ role: "PhD student", organisation: "Previous University" }];
    const speakerId = await backend.run(async (ctx) => {
        await ctx.db.patch(ids.memberId, { visibility: "public", affiliations: current });
        await ctx.db.insert("handles", {
            memberId: ids.memberId,
            name: "researcher",
            status: "active",
            createdAt: 1,
            updatedAt: 1,
        });
        return ctx.db.insert("speakers", {
            eventId: ids.eventId,
            memberId: ids.memberId,
            name: "Test",
            position: 0,
            createdAt: 1,
            updatedAt: 1,
        });
    });
    const read = async () =>
        (await backend.query(api.events.queries.event, { slug: "dinner" }))!.speakers[0];
    expect((await read()).affiliations).toEqual(current);
    await backend.run((ctx) => ctx.db.patch(speakerId, { affiliations: historical }));
    expect((await read()).affiliations).toEqual(historical);
    await backend.run((ctx) => ctx.db.patch(speakerId, { affiliations: [] }));
    expect((await read()).affiliations).toEqual([]);
    await backend.run(async (ctx) => {
        await ctx.db.patch(speakerId, { affiliations: undefined });
        await ctx.db.patch(ids.memberId, { visibility: "private" });
    });
    expect((await read()).affiliations).toBeUndefined();
});

// Search must match published news and never index a draft revision or a private address.
test("global search uses published content and returns safe highlights", async () => {
    const { backend, ids } = await setup();
    await backend.run(async (ctx) => {
        await ctx.db.patch(ids.eventId, {
            address: "Secretlane",
            addressAccess: { kind: "confirmed" },
        });
        const content = {
            kind: "post" as const,
            title: "Robotics announcement",
            description: "Zurich research",
            body: "Public demonstration",
            topics: [],
            authors: [],
            organisations: [],
        };
        await ctx.db.insert("posts", {
            slug: "robotics-announcement",
            draft: { ...content, title: "Unreleasedsecret" },
            published: content,
            publishedAt: 1,
            updatedAt: 1,
            createdBy: ids.memberId,
        });
    });
    const search = (text: string) =>
        backend.query(api.search.search.search, { text, now: Date.now() });
    expect(await search("Secretlane")).toEqual([]);
    expect(await search("Unreleasedsecret")).toEqual([]);
    const result = (await search("robotics")).find(
        (item) => item.href === "/news/1970/01/01/robotics-announcement",
    )!;
    expect(result.kind).toBe("News");
    expect(
        result.labelParts
            .filter((part) => part.isMatch)
            .map((part) => part.text)
            .join(""),
    ).toBe("Robotics");
    await backend.run((ctx) =>
        ctx.db.patch(ids.eventId, { status: "draft", title: "Privateeventsecret" }),
    );
    expect(await search("Privateeventsecret")).toEqual([]);
});

// The opening menu is public discovery, with the same disclosure rules as full search.
test("search catalogue includes published events without private venue data", async () => {
    const { backend, ids } = await setup();
    const now = Date.now();
    await backend.run((ctx) =>
        ctx.db.patch(ids.eventId, {
            status: "scheduled",
            slug: "discovery-event",
            startsAt: now + 86400000,
            address: "Hidden discovery address",
            location: "Hidden venue",
            addressAccess: { kind: "confirmed" },
        }),
    );
    const records = await backend.query(api.search.search.catalogue, {});
    expect(records.some((record) => record.href === "/events/discovery-event")).toBe(true);
    expect(JSON.stringify(records)).not.toContain("Hidden discovery address");
    expect(JSON.stringify(records)).not.toContain("Hidden venue");
    await backend.run((ctx) => ctx.db.patch(ids.eventId, { status: "draft" }));
    expect(
        (await backend.query(api.search.search.catalogue, {})).some(
            (record) => record.href === "/events/discovery-event",
        ),
    ).toBe(false);
});

// Scheduling continues existing series editions and is idempotent across fills.
test("recurring editions use series ordinal URLs and preserve an adopted edition", async () => {
    const { backend, editor, ids } = await setup();
    const { civilTime, timestamp } = await import("../convex/events/time");
    const start = civilTime(Date.now() + 86400000).slice(0, 10);
    const end = civilTime(Date.now() + 2 * 86400000).slice(0, 10);
    await backend.run(async (ctx) => {
        await ctx.db.patch(ids.grantId, {
            role: "organiser",
            scope: { kind: "series", id: ids.seriesId },
        });
        await ctx.db.patch(ids.memberId, { visibility: "public" });
        await ctx.db.insert("handles", {
            memberId: ids.memberId,
            name: "host",
            status: "active",
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.patch(ids.seriesId, { primaryOrganiserId: ids.memberId });
        await ctx.db.patch(ids.eventId, {
            title: "Dinner #5",
            slug: "dinners-5",
            number: 5,
            startsAt: timestamp(`${start}T19:00`),
        });
        await ctx.db.patch(ids.draftId, { startsAt: timestamp(`${start}T19:00`) });
    });
    const args = {
        seriesId: ids.seriesId,
        sourceId: ids.draftId,
        title: "Dinner #${count}",
        recurrence: {
            frequency: "daily" as const,
            interval: 1,
            weekdays: [],
            start,
            end,
            time: "19:00",
            timezone: "Europe/Zurich" as const,
            excluded: [],
        },
        publication: "draft" as const,
        status: "active" as const,
    };
    const id = await editor.mutation(api.events.schedules.save, args);
    await editor.mutation(api.events.schedules.save, { ...args, id });
    await backend.run(async (ctx) => {
        const events = await ctx.db
            .query("events")
            .withIndex("by_series", (q) => q.eq("seriesId", ids.seriesId))
            .collect();
        expect(events.map((event) => event.slug).sort()).toEqual(["dinners-5", "dinners-6"]);
        expect(events.find((event) => event.slug === "dinners-6")?.title).toBe("Dinner #6");
        expect((await ctx.db.get(ids.eventId))?.number).toBe(5);
    });
});

// Community answers remain private and cannot change subscriptions or authority.
test("test_preserve_private_answers_when_saving_public_profile", async () => {
    const { editor } = await setup();
    const answers = {
        demographics: { roles: ["sales", "other"] },
        interests: [],
        participation: ["volunteer"],
        motivations: ["learning"],
    };
    await editor.mutation(api.members.audience.save, answers);
    const before = await editor.query(api.members.audience.current, {});

    // edit public fields without submitting or clearing private answers
    await editor.mutation(api.members.profiles.save, {
        name: "Updated profile",
        isPublic: false,
        headline: "Engineer",
    });
    expect(await editor.query(api.members.audience.current, {})).toEqual(before);
});

test("community answers support refusal, multiple roles and clearing without changing access", async () => {
    const { backend, editor, ids } = await setup();
    await backend.run((ctx) =>
        ctx.db.insert("topics", { slug: "robotics", name: "Robotics", isActive: true }),
    );
    const before = await backend.run((ctx) => ctx.db.get(ids.accountId));
    await editor.mutation(api.members.audience.save, {
        demographics: {
            roles: ["engineering", "student"],
            residence: "CH",
            citizenships: ["CH", "DE"],
            languages: ["en", "de"],
            age: null,
            education: "master",
            experience: "2–5",
        },
        interests: ["robotics"],
        participation: ["attend", "speak"],
        motivations: ["friends", "learning"],
    });
    const result = await editor.query(api.members.audience.current, {});
    expect(result.demographics.roles).toEqual(["engineering", "student"]);
    expect(result.demographics.age).toBeNull();
    expect(result.demographics.residence).toBe("CH");
    expect(result.demographics.citizenships).toEqual(["CH", "DE"]);
    expect(result.demographics.languages).toEqual(["en", "de"]);
    expect(result.interests).toEqual(["robotics"]);
    expect(result.motivations).toEqual(["friends", "learning"]);
    await backend.run(async (ctx) => {
        const after = await ctx.db.get(ids.accountId);
        expect(after?.isAdmin).toBe(before?.isAdmin);
        expect(after?.isTeam).toBe(before?.isTeam);
        expect(await ctx.db.query("messages").collect()).toEqual([]);
        expect(await ctx.db.query("subscriptions").collect()).toEqual([]);
        expect((await ctx.db.get(ids.memberId))?.searchText).toBe("test");
    });
    await expect(
        editor.mutation(api.members.audience.save, {
            demographics: { roles: ["invented"] },
            interests: [],
            participation: [],
            motivations: [],
        }),
    ).rejects.toThrow();
    await expect(
        editor.mutation(api.members.audience.save, {
            demographics: {},
            interests: ["invented"],
            participation: [],
            motivations: [],
        }),
    ).rejects.toThrow();
    await editor.mutation(api.members.audience.save, {
        demographics: { roles: null },
        interests: [],
        participation: [],
        motivations: [],
    });
    expect((await editor.query(api.members.audience.current, {})).demographics.roles).toBeNull();
    await editor.mutation(api.members.audience.save, {
        demographics: {},
        interests: [],
        participation: [],
        motivations: [],
    });
    expect((await editor.query(api.members.audience.current, {})).demographics).toEqual({});
    expect((await editor.query(api.members.audience.current, {})).motivations).toEqual([]);
});

// Archived topics retain their identity but cannot acquire new assignments.
test("scoped editors cannot curate topics and archived interests can only be retained", async () => {
    const { backend, editor, ids } = await setup();
    await expect(
        editor.mutation(api.topics.queries.save, {
            slug: "robotics",
            name: "Robotics",
            isActive: true,
        }),
    ).rejects.toThrow();
    await backend.run((ctx) => ctx.db.patch(ids.accountId, { isAdmin: true }));
    await editor.mutation(api.topics.queries.save, {
        slug: "robotics",
        name: "Robotics",
        isActive: true,
    });
    await editor.mutation(api.members.audience.save, {
        demographics: {},
        interests: ["robotics"],
        participation: [],
        motivations: [],
    });
    await editor.mutation(api.topics.queries.save, {
        slug: "robotics",
        name: "Robotics",
        isActive: false,
    });
    await editor.mutation(api.members.audience.save, {
        demographics: {},
        interests: ["robotics"],
        participation: [],
        motivations: [],
    });
    await editor.mutation(api.members.audience.save, {
        demographics: {},
        interests: [],
        participation: [],
        motivations: [],
    });
    await expect(
        editor.mutation(api.members.audience.save, {
            demographics: {},
            interests: ["robotics"],
            participation: [],
            motivations: [],
        }),
    ).rejects.toThrow();
    // reuse an archived label, but reject reactivation while that label is active
    await editor.mutation(api.topics.queries.save, {
        slug: "robots",
        name: "Robotics",
        isActive: true,
    });
    await expect(
        editor.mutation(api.topics.queries.save, {
            slug: "robotics",
            name: "Robotics",
            isActive: true,
        }),
    ).rejects.toThrow("A topic already uses this name.");
});

test("address defaults do not trigger registration updates; real visibility changes do", async () => {
    const { sameAddressAccess } = await import("../convex/events/place");
    const { eventAction, confirmAction } = await import("../convex/events/actions");
    const { backend, ids } = await setup();
    expect(sameAddressAccess(undefined, { kind: "public" })).toBe(true);
    expect(sameAddressAccess({ kind: "public" }, undefined)).toBe(true);
    expect(
        sameAddressAccess(
            { kind: "external", url: "https://example.com", label: "Venue" },
            { label: "Venue", url: "https://example.com", kind: "external" },
        ),
    ).toBe(true);
    expect(
        sameAddressAccess(
            { kind: "external", url: "https://example.com", label: "Venue" },
            { kind: "external", url: "https://example.com/new", label: "Venue" },
        ),
    ).toBe(false);

    // Reproduce an ordinary editor save with an existing registered attendee.
    await backend.run(async (ctx) => {
        await ctx.db.insert("registrations", {
            eventId: ids.eventId,
            email: "attendee@example.invalid",
            name: "Attendee",
            status: "going",
            token: "test-token",
            createdAt: 1,
            updatedAt: 1,
        });
        const event = (await ctx.db.get(ids.eventId))!;
        const draft = (await ctx.db.get(ids.draftId))!;
        const proposed = {
            ...revisionFields(draft),
            addressAccess: { kind: "public" as const },
            coOrganiserIds: [ids.memberId],
        };
        expect((await eventAction(ctx, event, "publish", proposed)).updates).toBe(0);
        const before = await eventAction(ctx, event, "publish", {
            ...proposed,
            location: "New venue",
        });
        const after = await eventAction(ctx, event, "publish", {
            ...proposed,
            location: "Different venue",
        });
        expect(before.emails).toBe(after.emails);
        expect(() => confirmAction(after, before.receipt)).toThrow("review and confirm again");

        expect(
            (
                await eventAction(ctx, event, "publish", {
                    ...proposed,
                    addressAccess: { kind: "confirmed" },
                })
            ).updates,
        ).toBe(1);
        expect(
            (
                await eventAction(ctx, event, "publish", {
                    ...proposed,
                    startsAt: event.startsAt + 3600000,
                })
            ).updates,
        ).toBe(1);
    });
});

test("notification comparisons ignore presentation changes and explain private address updates", async () => {
    const { notificationChanges } = await import("../convex/events/changes");
    const { eventChanges } = await import("../convex/mail/templates");
    const { civilTime, timestamp } = await import("../convex/events/time");
    const event = {
        title: "Talk",
        slug: "talk",
        startsAt: 1791820800123,
        location: " Venue ",
        address: " Address ",
    };
    expect(notificationChanges(event, { ...event, location: "Venue", address: "Address" })).toEqual(
        [],
    );
    expect(timestamp(civilTime(event.startsAt), event.startsAt)).toBe(event.startsAt);
    const ambiguous = Date.parse("2026-10-25T00:30:00Z");
    expect(timestamp(civilTime(ambiguous), ambiguous)).toBe(ambiguous);
    expect(() => timestamp("2026-10-25T02:30")).toThrow("daylight saving");
    const privateEvent = {
        ...event,
        addressAccess: { kind: "confirmed" as const },
        address: "SECRET OLD",
    };
    const privateChange = { ...privateEvent, address: "SECRET NEW" };
    expect(notificationChanges(privateEvent, privateChange)).toEqual(["Address"]);
    expect(eventChanges(privateEvent, privateChange)).toContain("Address details changed");
    expect(eventChanges(privateEvent, privateChange)).not.toContain("SECRET");
    expect(
        notificationChanges(
            { ...event, addressAccess: { kind: "unannounced" } },
            { ...event, addressAccess: { kind: "unannounced" }, address: undefined },
        ),
    ).toEqual([]);
});

test("publishing an organiser-only edit neither queues mail nor rejects reordered question properties", async () => {
    const { publishEvent } = await import("../convex/events/mutations");
    const { backend, ids } = await setup();
    await backend.run(async (ctx) => {
        await ctx.db.patch(ids.memberId, { visibility: "public" });
        await ctx.db.insert("handles", {
            name: "organiser",
            memberId: ids.memberId,
            status: "active",
            createdAt: 1,
            updatedAt: 1,
        });
        const registration = {
            kind: "native" as const,
            admission: "automatic" as const,
            capacity: null,
            overflow: "waitlist" as const,
            questions: [{ label: "Question", isRequired: false }],
        };
        await ctx.db.patch(ids.eventId, { registration });
        await ctx.db.patch(ids.draftId, {
            primaryOrganiserId: ids.memberId,
            coOrganiserIds: [ids.memberId],
            addressAccess: { kind: "public" },
            registration: {
                ...registration,
                questions: [{ isRequired: false, label: "Question" }],
            },
        });
        await ctx.db.insert("registrations", {
            eventId: ids.eventId,
            email: "attendee@example.invalid",
            name: "Attendee",
            status: "going",
            token: "test-token",
            createdAt: 1,
            updatedAt: 1,
        });
        await publishEvent(ctx, ids.draftId);
        expect(await ctx.db.query("campaigns").collect()).toEqual([]);
        expect(await ctx.db.query("messages").collect()).toEqual([]);
        expect((await ctx.db.get(ids.eventId))?.coOrganiserIds).toEqual([ids.memberId]);
    });
});

test("unlisted events remain usable by link but leave public discovery and promotional mail", async () => {
    const { internal } = await import("../convex/_generated/api");
    const { eventAction } = await import("../convex/events/actions");
    const { requireOpenEvent } = await import("../convex/events/registrations");
    const { digestEvents } = await import("../convex/mail/newsletter");
    const { backend, editor, ids } = await setup();
    await backend.run(async (ctx) => {
        await ctx.db.patch(ids.memberId, { visibility: "public" });
        await ctx.db.insert("handles", {
            name: "host",
            memberId: ids.memberId,
            status: "active",
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.patch(ids.eventId, {
            primaryOrganiserId: ids.memberId,
            registration: {
                kind: "native",
                admission: "automatic",
                capacity: null,
                overflow: "waitlist",
                questions: [],
            },
        });
    });
    expect(
        (await backend.query(api.events.queries.calendar, {})).some(
            (event) => event.id === ids.eventId,
        ),
    ).toBe(true);
    await backend.run((ctx) => ctx.db.patch(ids.eventId, { visibility: "unlisted" }));
    expect(
        (await backend.query(api.events.queries.calendar, {})).some(
            (event) => event.id === ids.eventId,
        ),
    ).toBe(false);
    expect(JSON.stringify(await backend.query(api.search.search.catalogue, {}))).not.toContain(
        '"/events/dinner"',
    );
    expect(
        (await backend.query(api.members.queries.member, { handle: "host" }))?.hostedEvents,
    ).toEqual([]);
    expect((await backend.query(api.events.queries.event, { slug: "dinner" }))?.visibility).toBe(
        "unlisted",
    );
    expect(
        (await editor.query(api.events.management.workspace, {})).submissions.some(
            (draft) => draft.eventId === ids.eventId,
        ),
    ).toBe(true);

    const deliveryIds = await backend.run(async (ctx) => {
        const event = (await ctx.db.get(ids.eventId))!;
        const draft = (await ctx.db.get(ids.draftId))!;
        expect(requireOpenEvent(event).kind).toBe("native");
        expect(digestEvents([event], Date.now())).toEqual([]);
        const unchanged = await eventAction(ctx, event, "publish", revisionFields(draft));
        expect(unchanged.visibility).toBe("unlisted");
        expect(unchanged.visibilityChanged).toBe(false);
        const listed = await eventAction(ctx, event, "publish", {
            ...revisionFields(draft),
            visibility: "public",
        });
        expect(listed.visibility).toBe("public");
        expect(listed.visibilityChanged).toBe(true);

        await expect(
            eventAction(
                ctx,
                event,
                "publish",
                { ...revisionFields(draft), visibility: "unlisted" },
                true,
            ),
        ).rejects.toThrow("cannot be announced");
        const campaignId = await ctx.db.insert("campaigns", {
            subject: "Weekly",
            message: "Frozen edition",
            eventIds: [event._id],
            status: "queued",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
        const base = {
            isBulk: true,
            to: "attendee@example.invalid",
            subject: "Test",
            text: "Test",
            status: "queued" as const,
            nextAttemptAt: Date.now(),
            attempts: 0,
            createdAt: Date.now(),
        };
        const weekly = await ctx.db.insert("messages", {
            ...base,
            key: "weekly-test",
            category: "weekly",
            campaignId,
        });
        const announcement = await ctx.db.insert("messages", {
            ...base,
            key: "announcement-test",
            category: "announcement",
            eventId: event._id,
        });
        const update = await ctx.db.insert("messages", {
            ...base,
            key: "update-test",
            category: "update",
            eventId: event._id,
        });
        return { weekly, announcement, update };
    });
    expect(await backend.query(internal.mail.messages.read, { id: deliveryIds.weekly })).toBeNull();
    expect(
        await backend.query(internal.mail.messages.read, { id: deliveryIds.announcement }),
    ).toBeNull();
    expect(
        await backend.query(internal.mail.messages.read, { id: deliveryIds.update }),
    ).not.toBeNull();
});
