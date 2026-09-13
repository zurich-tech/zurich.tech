import { permissions, scopedEvents } from "./grants";
import { allows } from "./permissions";
import { query } from "../_generated/server";

import { socialProviders } from "./providers";

/** Expose enabled sign-in names without returning their credentials. */
export const signInProviders = query({
    args: {},
    handler: () => {
        const providers = Object.keys(socialProviders());
        if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) providers.push("email");
        return providers;
    },
});

/** Read the signed-in account's profile and scoped authority. */
export const current = query({
    args: {},
    handler: async (ctx) => {
        const { account, grants, isAdmin } = await permissions(ctx);
        const events = isAdmin ? [] : await scopedEvents(ctx, { account, grants, isAdmin });
        const targets = events.map((event) => ({ eventId: event._id, seriesId: event.seriesId }));

        const member = await ctx.db.get(account.memberId);
        return {
            isTeam: account.isTeam,
            isAdmin,
            grants: grants.map(({ scope, role }) => ({ scope, role })),
            canManage: isAdmin || grants.length > 0,
            editableEventIds: targets
                .filter((target) => allows({ isAdmin, grants }, target))
                .map((target) => target.eventId),
            organisedEventIds: targets
                .filter((target) => allows({ isAdmin, grants }, target, "organiser"))
                .map((target) => target.eventId),
            name: member?.name,
            avatarUrl: member?.avatarUrl,
            avatarDarkUrl: member?.avatarDarkUrl,
        };
    },
});
