import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import type { Content } from "./model";
import { register } from "../statistics/referrals";
import { siteOrigin } from "../auth/environment";
import { escapeHtml } from "./layout";
import { markdown } from "./markdown";

/** Tag public campaign destinations once, before any recipient-specific links exist. */
export async function attribute(content: Content, campaign: Doc<"campaigns">, ctx: MutationCtx) {
    // transactional mail and test previews retain their original links
    if (!["campaign", "weekly", "announcement"].includes(campaign.category ?? "")) return content;
    const origin = siteOrigin();
    const label = campaign.subject
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 24);
    const name = `${label || "mail"}-${campaign._id}`;
    const replacements = new Map<string, string>();

    // our email renderers emit escaped, double-quoted href attributes
    for (const match of (content.html ?? markdown(content.text)).matchAll(/href="([^"]*)"/g)) {
        const href = match[1]
            .replaceAll("&quot;", '"')
            .replaceAll("&#39;", "'")
            .replaceAll("&lt;", "<")
            .replaceAll("&gt;", ">")
            .replaceAll("&amp;", "&");
        if (replacements.has(href) || !URL.canParse(href)) continue;
        const url = new URL(href);
        if (url.origin !== origin || url.username || url.password) continue;
        if (
            [...url.searchParams.keys()].some(
                (key) => !["utm_source", "utm_medium", "utm_campaign"].includes(key),
            )
        )
            continue;

        // only published public paths may acquire campaign attribution
        const tags = { path: url.pathname, source: "newsletter", medium: "email", campaign: name };
        if (!(await register(tags, ctx))) continue;
        url.searchParams.set("utm_source", tags.source);
        url.searchParams.set("utm_medium", tags.medium);
        url.searchParams.set("utm_campaign", tags.campaign);
        replacements.set(href, url.href);
    }

    // replace exact destinations, never URL prefixes or personalised placeholders
    let html = content.html;
    let text = content.text;
    for (const [before, after] of replacements) {
        html = html?.replaceAll(`href="${escapeHtml(before)}"`, `href="${escapeHtml(after)}"`);
        const escaped = before.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        text = text.replace(
            new RegExp(`${escaped}(?=$|[\\s)\\]]|[.,!?](?:\\s|$))`, "g"),
            () => after,
        );
    }

    return { ...content, text, html };
}
