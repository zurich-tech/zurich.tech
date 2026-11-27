import { expect, test } from "bun:test";
import { convexTest, schema, modules, member } from "./backend";
import { api } from "../convex/_generated/api";

test("calendar portraits follow joint programme order and omit missing or removed photos", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const ownerId = await member(ctx, { name: "Host", searchText: "", visibility: "private" });
        const eventId = await ctx.db.insert("events", {
            title: "Talks",
            slug: "talks",
            format: "talk",
            topics: [],
            startsAt: 1,
            registration: { kind: "none" },
            ownerId,
            status: "scheduled",
            createdAt: 1,
            updatedAt: 1,
        });
        const speakers = [];
        for (const [position, name] of ["First", "Second", "Missing", "Removed"].entries()) {
            speakers.push(
                await ctx.db.insert("speakers", {
                    eventId,
                    name,
                    position,
                    imageUrl: name === "Missing" ? undefined : `https://example.com/${name}.jpg`,
                    isRemoved: name === "Removed",
                    createdAt: 1,
                    updatedAt: 1,
                }),
            );
        }
        await ctx.db.insert("sessions", {
            eventId,
            title: "Joint talk",
            time: "18:00",
            position: 0,
            speakerIds: [speakers[1], speakers[0]],
            createdAt: 1,
            updatedAt: 1,
        });
    });

    const [event] = await backend.query(api.events.queries.calendar, {});
    expect(event.speakers.map((speaker) => speaker.name)).toEqual(["Second", "First"]);
    expect(event.speakers.map((speaker) => speaker.href)).toEqual([
        "/events/talks#speakers",
        "/events/talks#speakers",
    ]);
});

test("calendar inherits only public portraits and preserves explicit event photos", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const ownerId = await member(ctx, { name: "Host", searchText: "", visibility: "private" });
        const eventId = await ctx.db.insert("events", {
            title: "Profiles",
            slug: "profiles",
            format: "talk",
            topics: [],
            startsAt: 1,
            registration: { kind: "none" },
            ownerId,
            status: "scheduled",
            createdAt: 1,
            updatedAt: 1,
        });
        for (const [position, visibility] of ["public", "private"].entries()) {
            const memberId = await member(ctx, {
                name: visibility,
                searchText: "",
                visibility: visibility as "public" | "private",
            });
            await ctx.db.patch(memberId, {
                avatarUrl: "https://example.com/profile.jpg",
                avatarDarkUrl: "https://example.com/dark.jpg",
            });
            await ctx.db.insert("handles", {
                memberId,
                name: visibility,
                status: "active",
                createdAt: 1,
                updatedAt: 1,
            });
            await ctx.db.insert("speakers", {
                eventId,
                memberId,
                name: visibility,
                position,
                createdAt: 1,
                updatedAt: 1,
            });
        }
        await ctx.db.insert("speakers", {
            eventId,
            memberId: ownerId,
            name: "Explicit",
            position: 2,
            imageUrl: "https://example.com/event.jpg",
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.insert("events", {
            title: "No speakers",
            slug: "empty",
            format: "social",
            topics: [],
            startsAt: 2,
            registration: { kind: "none" },
            ownerId,
            status: "scheduled",
            createdAt: 1,
            updatedAt: 1,
        });
    });

    const [event, empty] = await backend.query(api.events.queries.calendar, {});
    expect(event.speakers.map((speaker) => speaker.name)).toEqual(["public", "Explicit"]);
    expect(event.speakers[0]).toMatchObject({
        href: "/members/public",
        imageDark: "https://example.com/dark.jpg",
    });
    expect(event.speakers[1].image).toBe("https://example.com/event.jpg");
    expect(empty.speakers).toEqual([]);
});
