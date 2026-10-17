import { expect, test } from "bun:test";
import { makeFunctionReference } from "convex/server";
import { api } from "../convex/_generated/api";
import { convexTest, schema, modules, member } from "./backend";
import { newsDate, newsPath } from "../convex/news/path";
import { newsRedirect } from "../src/server/news";
import { isPublicPage } from "../src/server/pages";

/** Public canonical path lookup used by server redirects. */
const canonical = makeFunctionReference<"query", { slug: string }, string | null>(
    "news/routes:canonical",
);

test("test_build_news_paths_from_utc_dates_and_reject_invalid_inputs", () => {
    expect(newsPath({ slug: "original-result", date: Date.parse("2026-09-16T23:30:00Z") })).toBe(
        "/news/2026/09/16/original-result",
    );
    expect(newsPath({ slug: "leap-day", date: Date.UTC(2024, 1, 29) })).toBe(
        "/news/2024/02/29/leap-day",
    );
    expect(() => newsPath({ slug: "../edit", date: 0 })).toThrow("Invalid news slug.");
    expect(() => newsPath({ slug: "story", date: NaN })).toThrow();
    expect(() => newsDate({})).toThrow("Published news requires a valid story date.");
    expect(newsDate({ date: 1, published: { date: 2 }, publishedAt: 3 })).toBe(1);
    expect(newsDate({ published: { date: 2 }, publishedAt: 3 })).toBe(2);
    expect(newsDate({ publishedAt: 0 })).toBe(0);
});

test("test_redirect_legacy_and_incorrect_dates_permanently_without_touching_other_routes", async () => {
    const path = "/news/2026/09/16/result";
    const read = async (slug: string) => (slug === "result" ? path : null);
    for (const pathname of [
        "/news/result",
        "/news/result/",
        "/news/2025/01/01/result",
        path + "/",
    ]) {
        for (const method of ["GET", "HEAD"]) {
            const response = await newsRedirect(
                new Request(`https://zurich.tech${pathname}?ref=mail`, { method }),
                read,
            );
            expect({
                status: response?.status,
                location: response?.headers.get("Location"),
                body: await response?.text(),
            }).toEqual({
                status: 301,
                location: path + "?ref=mail",
                body: "",
            });
        }
    }
    for (const pathname of [path, "/news/missing"]) {
        expect(
            await newsRedirect(new Request(`https://zurich.tech${pathname}`), read),
        ).toBeUndefined();
    }
    for (const pathname of ["/news", "/news/edit", "/news/manage", "/news/new", "/events/result"]) {
        expect(
            await newsRedirect(new Request(`https://zurich.tech${pathname}`), async () => {
                throw new Error("Must not query");
            }),
        ).toBeUndefined();
    }
    expect(
        await newsRedirect(
            new Request("https://zurich.tech/news/result", { method: "POST" }),
            async () => {
                throw new Error("Must not query");
            },
        ),
    ).toBeUndefined();
    expect(isPublicPage(new Request(`https://zurich.tech${path}`))).toBe(true);
});

test("test_keep_backfill_url_date_when_display_date_changes_or_story_is_republished", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const id = await member(ctx, { name: "Editor", searchText: "", visibility: "public" });
        await ctx.db.insert("accounts", {
            authId: "editor",
            memberId: id,
            status: "active",
            isAdmin: true,
            isTeam: true,
            createdAt: 1,
            updatedAt: 1,
        });
    });
    const editor = backend.withIdentity({ subject: "editor" });
    const original = Date.UTC(2024, 1, 29);
    const content = {
        title: "Backfilled result",
        description: "A measured result.",
        body: "",
        kind: "link" as const,
        url: "https://example.com/result",
        date: original,
        topics: [],
        authors: [],
        organisations: [],
    };
    const saved = await editor.mutation(api.news.mutations.save, { slug: "result", content });
    expect(await backend.query(canonical, { slug: "result" })).toBeNull();
    const published = await editor.mutation(api.news.mutations.publish, {
        id: saved.id,
        expectedUpdatedAt: saved.updatedAt,
        isPublished: true,
    });
    const path = "/news/2024/02/29/result";
    expect(await backend.query(canonical, { slug: "result" })).toBe(path);

    // allow factual date corrections without changing the address already shared
    const corrected = Date.UTC(2024, 2, 1);
    const edited = await editor.mutation(api.news.mutations.save, {
        id: saved.id,
        slug: "result",
        expectedUpdatedAt: published.updatedAt,
        content: { ...content, date: corrected },
    });
    const revised = await editor.mutation(api.news.mutations.publish, {
        id: saved.id,
        expectedUpdatedAt: edited.updatedAt,
        isPublished: true,
    });
    const record = (await backend.run((ctx) => ctx.db.get(saved.id)))!;
    expect({
        date: record.date,
        displayed: record.published?.date,
        path: await backend.query(canonical, { slug: "result" }),
    }).toEqual({ date: original, displayed: corrected, path });
    const withdrawn = await editor.mutation(api.news.mutations.publish, {
        id: saved.id,
        expectedUpdatedAt: revised.updatedAt,
        isPublished: false,
    });
    expect(await backend.query(canonical, { slug: "result" })).toBeNull();
    await editor.mutation(api.news.mutations.publish, {
        id: saved.id,
        expectedUpdatedAt: withdrawn.updatedAt,
        isPublished: true,
    });
    expect(await backend.query(canonical, { slug: "result" })).toBe(path);
});

test("test_capture_legacy_original_date_before_editing_and_withdrawing", async () => {
    const backend = convexTest(schema, modules);
    const id = await backend.run(async (ctx) => {
        const author = await member(ctx, { name: "Editor", searchText: "", visibility: "public" });
        await ctx.db.insert("accounts", {
            authId: "editor",
            memberId: author,
            status: "active",
            isAdmin: true,
            isTeam: true,
            createdAt: 1,
            updatedAt: 1,
        });
        const content = {
            title: "Legacy",
            description: "Original result.",
            body: "",
            kind: "link" as const,
            url: "https://example.com",
            date: Date.UTC(2020, 0, 2),
            topics: [],
            authors: [],
            organisations: [],
        };
        return ctx.db.insert("posts", {
            slug: "legacy",
            draft: content,
            published: content,
            publishedAt: Date.UTC(2026, 9, 16),
            updatedAt: 1,
            createdBy: author,
        });
    });
    const editor = backend.withIdentity({ subject: "editor" });
    const record = (await backend.run((ctx) => ctx.db.get(id)))!;
    const saved = await editor.mutation(api.news.mutations.save, {
        id,
        slug: "legacy",
        expectedUpdatedAt: 1,
        content: { ...record.draft, date: Date.UTC(2020, 0, 3) },
    });
    await editor.mutation(api.news.mutations.publish, {
        id,
        expectedUpdatedAt: saved.updatedAt,
        isPublished: false,
    });
    expect((await backend.run((ctx) => ctx.db.get(id)))?.date).toBe(Date.UTC(2020, 0, 2));
});
