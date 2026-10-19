import { expect, test } from "bun:test";
import { convexTest, schema, modules, member } from "./backend";
import { api } from "../convex/_generated/api";

test("event survey counts confirmed registrations and hides sparse results", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const ownerId = await member(ctx, {
            name: "Admin",
            searchText: "admin",
            visibility: "private",
        });
        await ctx.db.insert("accounts", {
            authId: "admin",
            memberId: ownerId,
            status: "active",
            isAdmin: true,
            isTeam: true,
            createdAt: 1,
            updatedAt: 1,
        });
        const eventId = await ctx.db.insert("events", {
            ownerId,
            slug: "test",
            title: "Test",
            status: "scheduled",
            format: "talk",
            registration: { kind: "none" },
            topics: [],
            startsAt: 1,
            createdAt: 1,
            updatedAt: 1,
        });
        for (const [index, status] of (
            ["going", "going", "cancelled", "waitlist"] as const
        ).entries()) {
            const memberId = await member(ctx, {
                name: `Guest ${index}`,
                searchText: "guest",
                visibility: "private",
            });
            const email = `guest${index}@example.org`;
            await ctx.db.insert("emails", {
                email,
                memberId,
                isPrimary: true,
                createdAt: 1,
                updatedAt: 1,
            });
            await ctx.db.insert("accounts", {
                authId: `guest${index}`,
                memberId,
                status: "active",
                isAdmin: false,
                isTeam: false,
                surveyCompletedAt: index === 1 ? undefined : 1,
                motivations: ["learning"],
                createdAt: 1,
                updatedAt: 1,
            });
            await ctx.db.insert("registrations", {
                eventId,
                email,
                name: "Guest",
                status,
                createdAt: 1,
                updatedAt: 1,
            });
        }
    });

    await expect(
        backend.query(api.events.survey.report, { slug: "test", results: true }),
    ).rejects.toThrow();
    // public projection exposes only aggregate completion, never response groups
    expect(await backend.query(api.events.survey.report, { slug: "test", results: false })).toEqual(
        {
            title: "Test",
            registered: 2,
            completed: 1,
            questions: undefined,
        },
    );
    await expect(
        backend
            .withIdentity({ subject: "guest0" })
            .query(api.events.survey.report, { slug: "test", results: true }),
    ).rejects.toThrow();

    // organisers may project completion without reading survey answers
    await backend.run(async (ctx) => {
        const event = await ctx.db
            .query("events")
            .withIndex("by_slug", (q) => q.eq("slug", "test"))
            .unique();
        const account = await ctx.db
            .query("accounts")
            .withIndex("by_auth", (q) => q.eq("authId", "guest0"))
            .unique();
        await ctx.db.insert("accessGrants", {
            accountId: account!._id,
            scope: { kind: "event", id: event!._id },
            role: "organiser",
            updatedAt: 1,
        });
    });
    const organiser = backend.withIdentity({ subject: "guest0" });
    expect(
        (await organiser.query(api.events.survey.report, { slug: "test", results: false }))
            .registered,
    ).toBe(2);
    await expect(
        organiser.query(api.events.survey.report, { slug: "test", results: true }),
    ).rejects.toThrow("Admin access is required");

    const admin = backend.withIdentity({ subject: "admin" });
    expect(await admin.query(api.events.survey.report, { slug: "test", results: true })).toEqual({
        title: "Test",
        registered: 2,
        completed: 1,
        questions: [],
    });
    expect(
        (await admin.query(api.events.survey.report, { slug: "test", results: false })).questions,
    ).toBeUndefined();

    // knowing a draft slug does not make its attendance counts public
    await backend.run(async (ctx) => {
        const event = await ctx.db
            .query("events")
            .withIndex("by_slug", (query) => query.eq("slug", "test"))
            .unique();
        await ctx.db.patch(event!._id, { status: "draft" });
    });
    await expect(
        backend.query(api.events.survey.report, { slug: "test", results: false }),
    ).rejects.toThrow();
});
