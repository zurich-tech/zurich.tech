import { ConvexError, type Infer } from "convex/values";
import { validateTopics } from "../topics/queries";
import type { QueryCtx } from "../_generated/server";
import { content } from "./content";

/** Apply the same content rules to editor saves and imported articles. */
export async function validateContent(
    ctx: QueryCtx,
    input: Infer<typeof content>,
    previous: string[] = [],
) {
    // validate URLs and bounded text before storing content
    const value = {
        ...input,
        title: input.title.trim(),
        topics: [...new Set(input.topics.map((tag) => tag.trim().toLowerCase()).filter(Boolean))],
    };
    await validateTopics(ctx, value.topics, previous);

    if (
        !value.title ||
        value.title.length > 200 ||
        value.description.length > 500 ||
        value.body.length > 50000
    )
        throw new ConvexError("Check the title, summary and body lengths.");
    if (value.kind === "link" && !value.url) throw new ConvexError("Enter the original URL.");
    for (const url of [value.url, value.image].filter(Boolean)) {
        let parsed: URL;
        try {
            parsed = new URL(url!);
        } catch {
            throw new ConvexError("Enter a valid URL.");
        }
        if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password)
            throw new ConvexError("Use an HTTP or HTTPS URL.");
    }
    if (
        value.topics.length > 12 ||
        value.topics.some((tag) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag))
    )
        throw new ConvexError("Use up to 12 tags, with words separated by hyphens.");
    if (value.kind === "post" && !value.authors.length && !value.organisations.length)
        throw new ConvexError("Select an author or organisation.");
    for (const id of value.authors) {
        const author = await ctx.db.get(id);
        if (!author || author.visibility !== "public")
            throw new ConvexError("Choose authors with public profiles.");
    }
    for (const id of value.organisations)
        if (!(await ctx.db.get(id))) throw new ConvexError("Organisation not found.");
    if (value.kind === "post") value.url = undefined;
    return value;
}
