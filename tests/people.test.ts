import { expect, test } from "bun:test";
import { convexTest, schema, modules, member } from "./backend";
import { api } from "../convex/_generated/api";

test("include registration-only guests and use their latest name without duplicating contacts", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Admin",
            searchText: "admin",
            visibility: "private",
        });
        await ctx.db.insert("accounts", {
            memberId,
            authId: "admin",
            status: "active",
            isAdmin: true,
            isTeam: false,
            createdAt: 1,
            updatedAt: 1,
        });
        const eventId = await ctx.db.insert("events", {
            title: "Guests",
            slug: "guests",
            location: "Zurich",
            format: "talk",
            topics: [],
            startsAt: 1,
            ownerId: memberId,
            status: "finished",
            addressAccess: { kind: "unannounced" },
            registration: { kind: "none" },
            createdAt: 1,
            updatedAt: 1,
        });
        for (const [name, createdAt] of [
            ["Old name", 1],
            ["Current name", 2],
        ] as const) {
            await ctx.db.insert("registrations", {
                eventId,
                email: "guest@example.test",
                name,
                createdAt,
                updatedAt: createdAt,
                token: name,
                status: "cancelled",
            });
        }
    });
    const rows = await backend
        .withIdentity({ subject: "admin" })
        .query(api.members.management.list, {});
    const guests = rows.filter((row) =>
        row.contacts.some((contact) => contact.email === "guest@example.test"),
    );

    expect(guests).toHaveLength(1);
    expect(guests[0].name).toBe("Current name");
    expect(guests[0].account).toBe("none");
    expect(guests[0].contacts).toEqual([
        { email: "guest@example.test", status: "none", weekly: false },
    ]);
});

test("require admin access before exposing private contacts", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Editor",
            searchText: "editor",
            visibility: "private",
        });
        await ctx.db.insert("accounts", {
            memberId,
            authId: "editor",
            status: "active",
            isAdmin: false,
            isTeam: true,
            createdAt: 1,
            updatedAt: 1,
        });
    });
    await expect(backend.query(api.members.management.list, {})).rejects.toThrow(
        "Sign in required.",
    );
    await expect(
        backend.withIdentity({ subject: "editor" }).query(api.members.management.list, {}),
    ).rejects.toThrow("Admin access is required.");
});

test("include private members and unlinked subscriptions without duplicating addresses or exposing secrets", async () => {
    const backend = convexTest(schema, modules);
    const identifiers = await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Member",
            searchText: "member",
            visibility: "private",
        });
        await ctx.db.insert("accounts", {
            memberId,
            authId: "admin",
            status: "active",
            isAdmin: true,
            isTeam: false,
            createdAt: 2,
            updatedAt: 2,
            demographics: { age: "25–34" },
        });
        await ctx.db.insert("emails", {
            memberId,
            email: "member@example.test",
            isPrimary: true,
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.insert("subscriptions", {
            email: "member@example.test",
            status: "unsubscribed",
            token: "secret",
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.insert("subscriptions", {
            memberId,
            email: "secondary@example.test",
            status: "subscribed",
            weekly: false,
            token: "secret-2",
            createdAt: 2,
            updatedAt: 2,
        });
        const guest = await ctx.db.insert("subscriptions", {
            email: "guest@example.test",
            status: "suppressed",
            token: "secret-3",
            source: "newsletter",
            createdAt: 3,
            updatedAt: 3,
        });
        return { memberId, guest };
    });
    expect(
        await backend.withIdentity({ subject: "admin" }).query(api.members.management.list, {}),
    ).toEqual([
        {
            id: identifiers.memberId,
            name: "Member",
            status: "active",
            account: "active",
            createdAt: 1,
            source: "",
            contacts: [
                { email: "member@example.test", status: "unsubscribed", weekly: false },
                { email: "secondary@example.test", status: "subscribed", weekly: false },
            ],
        },
        {
            id: identifiers.guest,
            name: "",
            status: "contact",
            account: "none",
            createdAt: 3,
            source: "newsletter",
            contacts: [{ email: "guest@example.test", status: "suppressed", weekly: false }],
        },
    ]);
});
