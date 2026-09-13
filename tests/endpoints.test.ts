import { expect, test, mock } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import type { GenericQueryCtx, GenericDataModel } from "convex/server";
import { submissionFields } from "../convex/events/fields";

// replace only the external identity provider, retaining actual account and permission checks
mock.module("../convex/auth/component", () => ({
    authComponent: {
        getAuthUser: async (ctx: GenericQueryCtx<GenericDataModel>) => {
            const identity = await ctx.auth.getUserIdentity();
            if (!identity) throw new Error("Sign in required.");
            return { _id: identity.subject, email: "test@example.invalid", emailVerified: true };
        },
    },
}));
const modules = Object.fromEntries(
    [...new Bun.Glob("**/*.ts").scanSync({ cwd: "convex" })].map((path) => [
        `../convex/${path}`,
        () => import(`../convex/${path}`),
    ]),
);

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
        const accountId = await ctx.db.insert("accounts", {
            authId: "editor",
            memberId,
            status: "active",
            isTeam: true,
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
            organiserIds: [],
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

test("legacy admins retain authority, explicit non-admin team members do not", async () => {
    const { backend, editor, ids } = await setup();
    await backend.run((ctx) => ctx.db.patch(ids.accountId, { isTeam: true, isAdmin: undefined }));
    await expect(editor.query(api.auth.management.list, {})).resolves.toBeDefined();
    await backend.run((ctx) => ctx.db.patch(ids.accountId, { isAdmin: false }));
    await expect(editor.query(api.auth.management.list, {})).rejects.toThrow();
});

test("disabled accounts lose authority even with existing grants", async () => {
    const { backend, editor, ids } = await setup();
    await backend.run((ctx) => ctx.db.patch(ids.accountId, { status: "disabled", isAdmin: true }));
    await expect(editor.query(api.events.management.workspace, {})).rejects.toThrow();
});

test("saving a published-event draft changes neither the live event nor email queue", async () => {
    const { backend, editor, ids } = await setup();
    const draft = await backend.run((ctx) => ctx.db.get(ids.draftId));
    const fields = Object.fromEntries(
        Object.keys(submissionFields)
            .filter((key) => key in draft!)
            .map((key) => [key, (draft as any)[key]]),
    );
    await editor.mutation(api.events.mutations.save, {
        ...fields,
        id: ids.draftId,
        organiserIds: [ids.memberId],
        description: "Revised",
        publish: false,
    } as any);
    await backend.run(async (ctx) => {
        expect((await ctx.db.get(ids.eventId))?.description).toBe("Original");
        expect((await ctx.db.get(ids.draftId))?.description).toBe("Revised");
        expect(await ctx.db.query("deliveries").collect()).toEqual([]);
    });
    await expect(
        editor.mutation(api.events.mutations.save, {
            ...fields,
            id: ids.draftId,
            organiserIds: [ids.memberId],
            publish: true,
            receipt: "forged",
        } as any),
    ).rejects.toThrow();
    await expect(
        editor.mutation(api.events.mutations.save, {
            ...fields,
            id: ids.draftId,
            seriesId: ids.otherSeries,
            organiserIds: [ids.memberId],
            publish: false,
        } as any),
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
    const fields = Object.fromEntries(
        Object.keys(submissionFields)
            .filter((key) => key in draft!)
            .map((key) => [key, (draft as any)[key]]),
    );
    await editor.mutation(api.events.mutations.save, {
        ...fields,
        slug: "new-draft",
        organiserIds: [ids.memberId],
        publish: false,
    } as any);
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
        expect(await ctx.db.query("deliveries").collect()).toEqual([]);
    });
});
