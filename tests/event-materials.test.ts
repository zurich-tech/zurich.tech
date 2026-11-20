import { expect, test } from "bun:test";
import { convexTest, schema, modules, member } from "./backend";
import { api } from "../convex/_generated/api";
import { homepageEventStart } from "../convex/events/time";
import { previewEvents } from "../src/events/preview";

test("retain events through the following Zurich day across daylight saving changes", () => {
    for (const [now, expected] of [
        ["2026-11-21T22:59:59Z", "2026-11-19T23:00:00Z"],
        ["2026-11-21T23:00:00Z", "2026-11-20T23:00:00Z"],
        ["2026-03-29T22:00:00Z", "2026-03-28T23:00:00Z"],
        ["2026-10-25T23:00:00Z", "2026-10-24T22:00:00Z"],
        ["2027-01-01T12:00:00Z", "2026-12-30T23:00:00Z"],
    ])
        expect(homepageEventStart(Date.parse(now!))).toBe(Date.parse(expected!));

    const event = { startsAt: Date.parse("2026-11-20T17:00:00Z") };
    expect(
        previewEvents([event], 5, homepageEventStart(Date.parse("2026-11-21T22:59:59Z"))),
    ).toEqual([event]);
    expect(
        previewEvents([event], 5, homepageEventStart(Date.parse("2026-11-21T23:00:00Z"))),
    ).toEqual([]);
});

test("publish public event PDFs with organiser checks and delete their stored bytes", async () => {
    const backend = convexTest(schema, modules);
    const eventId = await backend.run(async (ctx) => {
        const ownerId = await member(ctx, {
            name: "Organiser",
            searchText: "organiser",
            visibility: "public",
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

        return ctx.db.insert("events", {
            ownerId,
            slug: "materials",
            title: "Materials",
            status: "scheduled",
            format: "talk",
            registration: { kind: "none" },
            topics: [],
            startsAt: 1,
            createdAt: 1,
            updatedAt: 1,
        });
    });
    const admin = backend.withIdentity({ subject: "admin" });
    const bytes = new TextEncoder().encode("%PDF-1.7\nexample").buffer;
    await expect(
        backend.action(api.events.materials.upload, { eventId, title: "Brief", bytes }),
    ).rejects.toThrow("Sign in required.");
    await expect(
        admin.action(api.events.materials.upload, {
            eventId,
            title: "Brief",
            bytes: new ArrayBuffer(0),
        }),
    ).rejects.toThrow("choose a PDF under 8 MB");
    await admin.action(api.events.materials.upload, { eventId, title: " Sponsor brief ", bytes });

    const published = await backend.query(api.events.queries.event, { slug: "materials" });
    expect(
        published!.materials.map((material) => ({ title: material.title, hasUrl: !!material.url })),
    ).toEqual([{ title: "Sponsor brief", hasUrl: true }]);
    const storageId = published!.materials[0]!.storageId;
    await backend.run(async (ctx) => {
        const account = await ctx.db.query("accounts").first();
        await ctx.db.insert("accounts", {
            authId: "guest",
            memberId: account!.memberId,
            status: "active",
            isAdmin: false,
            isTeam: false,
            createdAt: 1,
            updatedAt: 1,
        });
    });
    await expect(
        backend
            .withIdentity({ subject: "guest" })
            .action(api.events.materials.upload, { eventId, title: "Brief", bytes }),
    ).rejects.toThrow("organiser access is required to manage materials");
    await expect(
        backend.mutation(api.events.materials.remove, { eventId, storageId }),
    ).rejects.toThrow("Sign in required.");
    await backend.run(async (ctx) => {
        await ctx.db.patch(eventId, { status: "draft" });
    });
    expect(await backend.query(api.events.queries.event, { slug: "materials" })).toBeNull();
    await admin.mutation(api.events.materials.remove, { eventId, storageId });
    expect(
        await backend.run(async (ctx) => ({
            materials: (await ctx.db.get(eventId))!.materials,
            file: await ctx.storage.get(storageId),
        })),
    ).toEqual({ materials: [], file: null });
});
