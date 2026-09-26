import { internalMutation } from "../_generated/server";

/** Clear the retired map curation flag from every location; safe to run repeatedly. */
export const clearCuration = internalMutation({
    args: {},
    handler: async (ctx) => {
        let cleared = 0;
        for (const location of await ctx.db.query("locations").collect()) {
            if (location.isCurated === undefined) continue;
            await ctx.db.patch(location._id, { isCurated: undefined });
            cleared++;
        }

        return cleared;
    },
});
