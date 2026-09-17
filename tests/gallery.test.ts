import { convexTest, schema, modules, member } from "./backend";
import type { Id } from "../convex/_generated/dataModel";
import { expect, test } from "bun:test";
import { api } from "../convex/_generated/api";

test("gallery preserves album order and excludes unapproved photos and unfinished events", async () => {
    const backend = convexTest(schema, modules);
    const now = Date.UTC(2026, 8, 15);
    const expected = await backend.run(async (ctx) => {
        const ownerId = await member(ctx, {
            name: "Photographer",
            visibility: "private",
            searchText: "",
        });
        const albums = [];
        for (const [index, status] of ["finished", "finished", "scheduled", "finished"].entries()) {
            const eventId = await ctx.db.insert("events", {
                visibility: index === 3 ? "unlisted" : undefined,
                title: `Event ${index}`,
                slug: `event-${index}`,
                format: "talk",
                description: "",
                topics: [],
                startsAt: now - (3 - index) * 86400000,
                location: "Zurich",
                registration: { kind: "none" },
                ownerId,
                status: status as "finished" | "scheduled",
                createdAt: 1,
                updatedAt: 1,
            });
            const images = [];
            for (let position = 0; position < 7; position++) {
                const id = await ctx.db.insert("photos", {
                    eventId,
                    uploaderId: ownerId,
                    key: `${index}/${position}.jpg`,
                    thumbnailKey: `${index}/${position}.webp`,
                    status: position === 0 ? "pending" : "approved",
                    position,
                    width: 100,
                    height: 80,
                    createdAt: 1,
                    updatedAt: 1,
                });
                if (position > 0 && position <= 5)
                    images.push({
                        id,
                        alt: `Photo from Event ${index}`,
                        width: 100,
                        height: 80,
                        thumbnailUrl: `https://media.zurich.tech/${index}/${position}.webp`,
                    });
            }
            if (status === "finished" && index !== 3)
                albums.unshift({
                    title: `Event ${index}`,
                    href: `/events/event-${index}#photos`,
                    year: 2026,
                    images,
                });
        }
        return albums;
    });

    expect(await backend.query(api.events.gallery.gallery, {})).toEqual(expected);
});

test("photo publication is restricted to team accounts and scoped organisers, with storage cleanup", async () => {
    const backend = convexTest(schema, modules);
    const ids = await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Photographer",
            searchText: "",
            visibility: "private",
        });
        const accounts = {} as Record<string, Id<"accounts">>;
        for (const authId of ["team", "organiser", "editor", "visitor"])
            accounts[authId] = await ctx.db.insert("accounts", {
                memberId,
                authId,
                isTeam: authId === "team",
                isAdmin: false,
                status: "active",
                createdAt: 1,
                updatedAt: 1,
            });
        const event = {
            title: "Album",
            slug: "album",
            format: "talk" as const,
            description: "",
            topics: [],
            startsAt: 1,
            location: "Zurich",
            registration: { kind: "none" as const },
            ownerId: memberId,
            status: "finished" as const,
            createdAt: 1,
            updatedAt: 1,
        };
        const eventId = await ctx.db.insert("events", event);
        const otherId = await ctx.db.insert("events", { ...event, slug: "other" });
        for (const role of ["organiser", "editor"] as const)
            await ctx.db.insert("accessGrants", {
                accountId: accounts[role]!,
                scope: { kind: "event", id: eventId },
                role,
                updatedAt: 1,
            });
        return { eventId, otherId };
    });
    const bytes = new TextEncoder().encode("RIFF1234WEBP1234").buffer;
    const args = { eventId: ids.eventId, bytes, thumbnail: bytes, width: 100, height: 80 };
    for (const authId of ["visitor", "editor"]) {
        await expect(
            backend.withIdentity({ subject: authId }).action(api.events.photos.upload, args),
        ).rejects.toThrow("Team or organiser");
    }
    await expect(backend.action(api.events.photos.upload, args)).rejects.toThrow();
    const organiser = backend.withIdentity({ subject: "organiser" });
    await expect(
        organiser.action(api.events.photos.upload, { ...args, eventId: ids.otherId }),
    ).rejects.toThrow("Team or organiser");
    await expect(
        organiser.action(api.events.photos.upload, { ...args, bytes: new ArrayBuffer(3) }),
    ).rejects.toThrow("valid WebP");
    await organiser.action(api.events.photos.upload, args);
    await backend.withIdentity({ subject: "team" }).action(api.events.photos.upload, args);
    const photos = await backend.run((ctx) => ctx.db.query("photos").collect());
    expect(photos.map((photo) => photo.position)).toEqual([0, 1]);
    expect((await backend.query(api.events.gallery.gallery, {}))[0]!.images).toHaveLength(2);
    await expect(
        backend
            .withIdentity({ subject: "visitor" })
            .mutation(api.events.photos.remove, { id: photos[0]!._id }),
    ).rejects.toThrow();
    await organiser.mutation(api.events.photos.remove, { id: photos[0]!._id });
    expect(await backend.run((ctx) => ctx.db.system.query("_storage").collect())).toHaveLength(2);
});
