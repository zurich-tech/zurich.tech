import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { isPublicMember, memberHandle } from "../members/queries";

/** Read only the consented public identity used for organiser attribution. */
export async function publicOrganiser(ctx: QueryCtx, id?: Id<"members">) {
    if (!id) return null;
    const member = await ctx.db.get(id);
    if (!isPublicMember(member)) return null;
    const handle = await memberHandle(ctx, id);
    if (!handle) return null;

    return {
        name: member.name,
        href: `/members/${handle.name}`,
        image: member.avatarUrl,
        headline: member.headline,
        affiliations: member.affiliations,
    };
}

/** Require a public profile before assigning public attribution. */
export async function validatePrimaryOrganiser(ctx: QueryCtx, id?: Id<"members">) {
    if (id && !(await publicOrganiser(ctx, id)))
        throw new Error("Choose an organiser with a public profile.");
}

/** Resolve ordered public credits independently from editing assignments. */
export function organiserIds(
    event: { primaryOrganiserId?: Id<"members">; coOrganiserIds?: Id<"members">[] },
    series?: { primaryOrganiserId?: Id<"members">; coOrganiserIds?: Id<"members">[] } | null,
) {
    const primary = event.primaryOrganiserId ?? series?.primaryOrganiserId;
    const others = [...new Set(event.coOrganiserIds ?? series?.coOrganiserIds ?? [])].filter(
        (id) => id !== primary,
    );
    return { primary, others };
}

/** Expand a primary organiser and distinct public co-organisers in display order. */
export async function publicOrganisers(
    ctx: QueryCtx,
    event: Parameters<typeof organiserIds>[0],
    series?: Parameters<typeof organiserIds>[1],
) {
    const ids = organiserIds(event, series);
    const [organiser, ...others] = await Promise.all(
        [ids.primary, ...ids.others].map((id) => publicOrganiser(ctx, id)),
    );
    return { organiser, coOrganisers: others.filter((person) => person !== null) };
}

/** Require explicit public profiles and bound the number of displayed credits. */
export async function validateCoOrganisers(ctx: QueryCtx, ids?: Id<"members">[]) {
    if ((ids?.length ?? 0) > 20) throw new Error("Choose at most 20 co-organisers.");
    if (ids && new Set(ids).size !== ids.length) throw new Error("Choose each co-organiser once.");
    await Promise.all((ids ?? []).map((id) => validatePrimaryOrganiser(ctx, id)));
}
