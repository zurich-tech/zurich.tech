import { convexTest, schema, modules, member } from "./backend";
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
        for (const [index, status] of ["finished", "finished", "scheduled"].entries()) {
            const eventId = await ctx.db.insert("events", {
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
            if (status === "finished")
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
