import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { catalogue, validateHierarchy } from "./catalogue";

/** Add Games only, previewing conflicts without overwriting existing curation. */
export const installGames = internalMutation({
    args: { apply: v.boolean() },
    handler: async (ctx, args) => {
        // reject conflicting keys or labels before considering any write
        const topics = await ctx.db.query("topics").take(101);
        if (topics.length > 100)
            throw new Error("Review catalogues larger than 100 topics separately.");
        const games = topics.filter(
            (topic) => topic.slug === "games" || topic.name.trim().toLowerCase() === "games",
        );
        const existing = games[0];
        if (
            games.length > 1 ||
            (existing &&
                (existing.slug !== "games" ||
                    existing.name !== "Games" ||
                    !existing.isActive ||
                    existing.parent !== undefined))
        )
            throw new Error("Review the existing Games topic before installing.");

        // leave every existing record and reference untouched
        if (!existing && args.apply)
            await ctx.db.insert("topics", { slug: "games", name: "Games", isActive: true });

        return { applied: args.apply, created: existing ? 0 : 1, unchanged: existing ? 1 : 0 };
    },
});

/** Install the approved hierarchy without deleting legacy subjects or their references. */
export const install = internalMutation({
    args: { apply: v.boolean() },
    handler: async (ctx, args) => {
        // bound the catalogue transaction independently of the number of referencing records
        const existing = await ctx.db.query("topics").take(101);
        if (existing.length > 100)
            throw new Error("Review catalogues larger than 100 topics separately.");
        const approved = new Set(catalogue.map((topic) => topic.slug));
        const legacy = existing.filter((topic) => !approved.has(topic.slug));
        const desired = [
            ...catalogue.map((topic) => ({ ...topic, isActive: true })),
            ...legacy.map((topic) => ({ ...topic, isActive: false })),
        ];
        if (desired.length > 100)
            throw new Error("Review catalogues larger than 100 topics separately.");
        if (new Set(existing.map((topic) => topic.slug)).size !== existing.length)
            throw new Error("Topic keys must be unique.");
        validateHierarchy(desired);

        // compare before writing so preview and application return the same changes
        const result = { applied: args.apply, created: 0, updated: 0, archived: 0, unchanged: 0 };
        for (const topic of desired) {
            const previous = existing.find((item) => item.slug === topic.slug);
            if (!previous) {
                if (args.apply) await ctx.db.insert("topics", topic);
                result.created++;
            } else if (
                previous.name !== topic.name ||
                previous.parent !== topic.parent ||
                previous.isActive !== topic.isActive
            ) {
                if (args.apply)
                    await ctx.db.patch(previous._id, {
                        name: topic.name,
                        parent: topic.parent,
                        isActive: topic.isActive,
                    });
                if (topic.isActive) result.updated++;
                else result.archived++;
            } else result.unchanged++;
        }

        return result;
    },
});
