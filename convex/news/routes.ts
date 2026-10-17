import { v } from "convex/values";
import { query } from "../_generated/server";
import { newsDate, newsPath } from "./path";

/** Resolve public canonical paths without expanding article bodies or relationships. */
export const canonical = query({
    args: { slug: v.string() },
    handler: async (ctx, { slug }) => {
        const post = await ctx.db
            .query("posts")
            .withIndex("by_slug", (query) => query.eq("slug", slug))
            .unique();

        return post?.published ? newsPath({ slug: post.slug, date: newsDate(post) }) : null;
    },
});
