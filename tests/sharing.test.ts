import { expect, test } from "bun:test";
import sharp from "sharp";
import { makeFunctionReference } from "convex/server";
import { convexTest, member, modules, schema } from "./backend";
import { eventImage, imageDate, speakerGroups, type SharedEvent } from "../src/events/sharing";
import { posterFont, posterPng, posterSvg, textLines, textWidth } from "../src/server/poster";
import { imageData, portraitData, publicPortrait } from "../src/server/portraits";

/** A two-talk programme with two people sharing its first talk. */
const event: SharedEvent = {
    title: "ZurichHW #1",
    startsAt: Date.parse("2026-11-26T17:00:00Z"),
    status: "scheduled",
    speakers: [
        {
            id: "filippo",
            name: "Filippo Moro",
            affiliations: [{ organisation: "UZH / ETH Zurich", role: "" }],
        },
        {
            id: "arianna",
            name: "Arianna Rubino",
            affiliations: [{ organisation: "ETH Zurich", role: "" }],
        },
        {
            id: "frank",
            name: "Frank Kagan Gürkaynak",
            affiliations: [{ organisation: "ETH Zurich", role: "" }],
        },
    ],
    sessions: [
        { speakerIds: ["arianna", "frank"] },
        { speakerIds: ["filippo"] },
        { speakerIds: ["arianna"] },
    ],
};

test("groups co-speakers in programme order without repeating appearances", () => {
    expect(speakerGroups(event).map((group) => group.map((person) => person.id))).toEqual([
        ["arianna", "frank"],
        ["filippo"],
    ]);
    expect(speakerGroups({ ...event, sessions: [] })).toHaveLength(3);
    expect(() => speakerGroups({ ...event, sessions: [{ speakerIds: ["missing"] }] })).toThrow(
        "programme speaker is missing",
    );
});

test("sharing URLs are stable and dates include the Zurich-local year and time", () => {
    expect(eventImage("zurichhw-1")).toBe("/og/events/zurichhw-1.png");
    expect(imageDate(event.startsAt)).toBe("26 November 2026 · 18:00");
    expect(imageDate(Date.parse("2026-07-01T17:00:00Z"))).toBe("1 July 2026 · 19:00");
});

test("portrait URLs reject local addresses, credentials and non-HTTPS schemes", () => {
    for (const url of [
        "http://example.com/a",
        "https://127.0.0.1/a",
        "https://[::1]/a",
        "https://2130706433/a",
        "https://server.local/a",
        "https://name:secret@example.com/a",
    ])
        expect(publicPortrait(url)).toBe(false);
    expect(publicPortrait("https://images.example.com/photo.webp")).toBe(true);
});

test("WebP portraits become bounded PNGs before rendering", async () => {
    const webp = await sharp({
        create: { width: 720, height: 480, channels: 3, background: "#ff0000" },
    })
        .webp()
        .toBuffer();
    const result = await portraitData(webp);
    expect(result).toStartWith("data:image/png;base64,");
    const bytes = Buffer.from(result.split(",")[1]!, "base64");
    expect(await sharp(bytes).metadata()).toMatchObject({ width: 208, height: 139, format: "png" });
});

test("text fits its measured column and the renderer produces a nonblank 1200 by 630 PNG", async () => {
    const [regular, bold, heading, map, logo] = await Promise.all([
        Bun.file("public/branding/fonts/Archivo-Regular.ttf").arrayBuffer(),
        Bun.file("public/branding/fonts/Archivo-SemiBold.ttf").arrayBuffer(),
        Bun.file("public/branding/fonts/JetBrainsMono-ExtraBold.ttf").arrayBuffer(),
        Bun.file("public/branding/events.png").bytes(),
        Bun.file("public/branding/logo.png").bytes(),
    ]);
    const font = posterFont(regular);
    const lines = textLines(
        "A very long name with an extremelylongunbrokentoken",
        font,
        42,
        250,
        2,
    );
    expect(lines.length).toBeLessThanOrEqual(2);
    for (const line of lines) expect(textWidth(line, font, 42)).toBeLessThanOrEqual(250);
    expect(lines.at(-1)).toEndWith("…");

    const assets = {
        regular,
        bold,
        heading,
        map: imageData(map, "image/png"),
        logo: imageData(logo, "image/png"),
    };
    const svg = posterSvg(event, assets, new Map());
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain('href="https:');
    const png = await posterPng(svg);
    expect(await sharp(png).metadata()).toMatchObject({ width: 1200, height: 630, format: "png" });
    const statistics = await sharp(png).stats();
    expect(statistics.channels[0]!.stdev).toBeGreaterThan(10);
});

test("public sharing query excludes drafts and exposes only image fields", async () => {
    const backend = convexTest(schema, modules);
    const id = await backend.run(async (ctx) => {
        const ownerId = await member(ctx, {
            name: "Owner",
            searchText: "owner",
            visibility: "private",
        });
        return ctx.db.insert("events", {
            ownerId,
            slug: "sharing",
            title: "Sharing",
            status: "draft",
            format: "talk",
            registration: { kind: "none" },
            topics: [],
            startsAt: 1,
            createdAt: 1,
            updatedAt: 1,
        });
    });
    const query = makeFunctionReference<"query", { slug: string }, SharedEvent | null>(
        "events/sharing:image",
    );
    expect(await backend.query(query, { slug: "sharing" })).toBeNull();
    expect(await backend.query(query, { slug: "absent" })).toBeNull();
    await backend.run((ctx) => ctx.db.patch(id, { status: "scheduled", visibility: "unlisted" }));
    expect(await backend.query(query, { slug: "sharing" })).toEqual({
        title: "Sharing",
        startsAt: 1,
        status: "scheduled",
        speakers: [],
        sessions: [],
    });
    await backend.run(async (ctx) => {
        const person = await member(ctx, {
            name: "Speaker",
            searchText: "speaker",
            visibility: "private",
        });
        await ctx.db.patch(person, { avatarUrl: "https://example.com/private.png" });
        const speaker = await ctx.db.insert("speakers", {
            eventId: id,
            memberId: person,
            name: "Public speaking name",
            position: 0,
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.insert("sessions", {
            eventId: id,
            speakerIds: [speaker],
            time: "18:05",
            title: "Talk",
            position: 0,
            createdAt: 1,
            updatedAt: 1,
        });
    });
    const published = await backend.query(query, { slug: "sharing" });
    expect(published!.speakers[0]!.name).toBe("Public speaking name");
    expect(published!.speakers[0]!.imageUrl).toBeUndefined();
    expect(published!.sessions[0]!.speakerIds).toEqual([published!.speakers[0]!.id]);
});
