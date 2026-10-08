import { expect, test } from "bun:test";
import { signupHistory } from "../convex/events/history";
import { convexTest, schema, modules, member } from "./backend";
import { api } from "../convex/_generated/api";

test("test_group_signups_in_zurich_and_keep_quiet_days_across_dst", () => {
    expect(
        signupHistory(
            [
                { _creationTime: Date.parse("2026-10-24T22:30:00Z") },
                { _creationTime: Date.parse("2026-10-25T01:30:00Z") },
                { _creationTime: Date.parse("2026-10-27T10:00:00Z") },
                { _creationTime: Date.parse("2026-10-23T10:00:00Z"), source: "import" },
                { _creationTime: Date.parse("2026-10-29T10:00:00Z") },
            ],
            Date.parse("2026-10-28T10:00:00Z"),
        ),
    ).toEqual([
        { date: "2026-10-25", added: 2, total: 2 },
        { date: "2026-10-26", added: 0, total: 2 },
        { date: "2026-10-27", added: 1, total: 3 },
        { date: "2026-10-28", added: 0, total: 3 },
    ]);
    expect(signupHistory([], Date.now())).toEqual([]);
});

test("test_restrict_history_to_organisers_and_include_closed_registrations", async () => {
    const backend = convexTest(schema, modules);
    const eventId = await backend.run(async (ctx) => {
        const memberId = await member(ctx, { name: "Host", searchText: "", visibility: "private" });
        const eventId = await ctx.db.insert("events", {
            title: "History",
            slug: "history",
            ownerId: memberId,
            topics: [],
            format: "talk",
            status: "scheduled",
            startsAt: Date.now() + 86400000,
            registration: {
                kind: "native",
                capacity: null,
                admission: "automatic",
                overflow: "waitlist",
                questions: [],
            },
            createdAt: 1,
            updatedAt: 1,
        });
        for (const role of ["organiser", "editor"] as const) {
            const accountId = await ctx.db.insert("accounts", {
                authId: role,
                memberId,
                isAdmin: false,
                isTeam: false,
                status: "active",
                createdAt: 1,
                updatedAt: 1,
            });
            await ctx.db.insert("accessGrants", {
                accountId,
                scope: { kind: "event", id: eventId },
                role,
                updatedAt: 1,
            });
        }
        for (const status of ["going", "waitlist", "cancelled", "declined", "pending"] as const) {
            await ctx.db.insert("registrations", {
                eventId,
                name: status,
                email: `${status}@example.invalid`,
                status,
                createdAt: 1,
                updatedAt: 1,
            });
        }
        return eventId;
    });
    await expect(backend.query(api.events.registrations.history, { eventId })).rejects.toThrow();
    await expect(
        backend
            .withIdentity({ subject: "editor" })
            .query(api.events.registrations.history, { eventId }),
    ).rejects.toThrow("You do not have access to this event.");
    const result = await backend
        .withIdentity({ subject: "organiser" })
        .query(api.events.registrations.history, { eventId });
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(Date.now());
    expect(result).toEqual([{ date, added: 5, total: 5 }]);

    // imported records and repeat registration updates cannot change first-signup totals
    await backend.run(async (ctx) => {
        const rows = await ctx.db.query("registrations").collect();
        await ctx.db.patch(rows[0]!._id, { createdAt: Date.now(), status: "cancelled" });
        await ctx.db.insert("registrations", {
            eventId,
            name: "Imported",
            email: "import@example.invalid",
            source: "legacy",
            status: "going",
            createdAt: 1,
            updatedAt: 1,
        });
    });
    const organiser = backend.withIdentity({ subject: "organiser" });
    expect(await organiser.query(api.events.registrations.history, { eventId })).toEqual(result);

    // permission on this event grants no access to another event
    const otherId = await backend.run(async (ctx) => {
        const { _id, _creationTime, ...event } = (await ctx.db.get(eventId))!;
        return ctx.db.insert("events", { ...event, slug: "other" });
    });
    await expect(
        organiser.query(api.events.registrations.history, { eventId: otherId }),
    ).rejects.toThrow("You do not have access to this event.");

    // external registration histories are not reconstructed from local imports
    await backend.run(async (ctx) => {
        await ctx.db.patch(eventId, {
            registration: { kind: "external", url: "https://example.org" },
        });
    });
    expect(await organiser.query(api.events.registrations.history, { eventId })).toEqual([]);

    // revocation applies to the next request, even after a successful read
    await backend.run(async (ctx) => {
        const grants = await ctx.db.query("accessGrants").collect();
        for (const grant of grants) await ctx.db.delete(grant._id);
    });
    await expect(organiser.query(api.events.registrations.history, { eventId })).rejects.toThrow(
        "You do not have access to this event.",
    );
});
