import { requireAccount } from "./access";
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

/** Read the signed-in account's team permission. */
export const current = query({
    args: {},
    handler: async (ctx) => {
        const account = await requireAccount(ctx);

        const member = await ctx.db.get(account.memberId);
        return {
            isTeam: account.isTeam,
            name: member?.name,
            avatarUrl: member?.avatarUrl,
            avatarDarkUrl: member?.avatarDarkUrl,
        };
    },
});
