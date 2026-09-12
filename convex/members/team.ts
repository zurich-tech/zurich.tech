import { query, type QueryCtx } from "../_generated/server";
import { readProfiles } from "./links";

/** Public team roles and their curated profiles, independent of account privileges. */
export const list = query({
    args: {},
    handler: async (ctx) => {
        const organisation = await ctx.db
            .query("organisations")
            .withIndex("by_slug", (q) => q.eq("slug", "zurich-tech"))
            .unique();
        if (!organisation) return [];
        const roles = await ctx.db
            .query("roles")
            .withIndex("by_organisation", (q) => q.eq("organisationId", organisation._id))
            .collect();
        const profiles = await Promise.all(
            roles
                .filter((role) => role.isPublic)
                .sort((a, b) => a.position - b.position)
                .map(async (role) => {
                    const member = await ctx.db.get(role.memberId);
                    if (
                        !member ||
                        member.visibility !== "public" ||
                        member.status === "blocked" ||
                        member.status === "deleted"
                    )
                        return null;
                    return {
                        name: member.name,
                        role: role.status === "former" ? "Emeritus" : role.name,
                        profession: member.headline,
                        image: member.avatarUrl,
                        imageDark: member.avatarDarkUrl,
                        links: (await readProfiles(ctx, member._id)).socials ?? {},
                    };
                }),
        );
        return profiles.filter((profile) => profile !== null);
    },
});

/** Read current team members eligible to organise events. */
export async function readTeam(ctx: QueryCtx) {
    // combine public team roles with active team accounts
    const organisation = await ctx.db
        .query("organisations")
        .withIndex("by_slug", (q) => q.eq("slug", "zurich-tech"))
        .unique();
    const roles = organisation
        ? await ctx.db
              .query("roles")
              .withIndex("by_organisation", (q) => q.eq("organisationId", organisation._id))
              .collect()
        : [];
    const accounts = await ctx.db.query("accounts").collect();
    const ids = new Set([
        ...roles.filter((role) => role.status === "active").map((role) => role.memberId),
        ...accounts
            .filter((account) => account.status === "active" && account.isTeam)
            .map((account) => account.memberId),
    ]);

    // exclude unavailable profiles from assignments
    const members = await Promise.all([...ids].map((id) => ctx.db.get(id)));

    return members.filter(
        (member): member is NonNullable<typeof member> =>
            member !== null && (member.status === "active" || member.status === "imported"),
    );
}
