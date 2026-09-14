import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/** Refine the shared catalogue; preserve existing selections without guessing new interests. */
export const refine = internalMutation({
    args: { apply: v.boolean() },
    handler: async (ctx, { apply }) => {
        const choices = [
            ["robotics", "Robotics"],
            ["reinforcement-learning", "RL"],
            ["nlp", "NLP"],
            ["computer-vision", "CV"],
            ["agents", "Agents"],
            ["ai-policy", "Policy"],
            ["ai-ethics", "AI ethics"],
            ["community", "Community"],
            ["ai-safety", "AI safety"],
            ["data-engineering", "Data"],
            ["distributed-systems", "Systems"],
            ["security", "Security"],
            ["hardware", "Hardware"],
            ["product-design", "Design"],
            ["biotech", "Biotech"],
            ["climate-tech", "Energy"],
            ["software-engineering", "Software"],
            ["graphics", "Graphics"],
            ["startups", "Startups"],
        ];
        const changes = [];
        for (const [slug, name] of choices) {
            const existing = await ctx.db
                .query("topics")
                .withIndex("by_slug", (q) => q.eq("slug", slug))
                .unique();
            if (existing?.name === name && existing.isActive) continue;
            changes.push({ slug, name, action: existing ? "rename" : "add" });
            if (!apply) continue;
            if (existing) await ctx.db.patch(existing._id, { name, isActive: true });
            else await ctx.db.insert("topics", { slug, name, isActive: true });
        }
        // compact member interests without changing historic content tags
        const removed = new Set(["ai-safety", "community", "machine-learning"]);
        for (const account of await ctx.db.query("accounts").collect()) {
            const interests = [
                ...new Set(
                    (account.interests ?? [])
                        .filter((slug) => !removed.has(slug))
                        .map((slug) =>
                            slug === "ai-ethics"
                                ? "ai-policy"
                                : slug === "distributed-systems"
                                  ? "software-engineering"
                                  : slug,
                        ),
                ),
            ];
            const demographics = { ...account.demographics };
            const languages = demographics.languages?.filter((language) => language !== "other");
            if (languages?.length) demographics.languages = languages;
            else delete demographics.languages;
            const isChanged =
                JSON.stringify(interests) !== JSON.stringify(account.interests ?? []) ||
                JSON.stringify(demographics) !== JSON.stringify(account.demographics ?? {});
            if (!isChanged) continue;
            changes.push({ slug: String(account._id), name: "Survey choices", action: "compact" });
            if (apply) await ctx.db.patch(account._id, { interests, demographics });
        }
        return changes;
    },
});
