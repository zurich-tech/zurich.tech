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
