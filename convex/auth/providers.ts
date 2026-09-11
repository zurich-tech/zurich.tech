import { requiredEnvironment } from "./environment";

/** Build only providers with both credentials configured on this deployment. */
export function socialProviders() {
    const providers: Partial<
        Record<
            "google" | "github" | "twitter",
            {
                clientId: string;
                clientSecret: string;
                overrideUserInfoOnSignIn: boolean;
                disableDefaultScope?: boolean;
                scope?: string[];
            }
        >
    > = {};
    // enable each provider only when this deployment has its credentials
    for (const provider of ["google", "github", "twitter"] as const) {
        const prefix = provider.toUpperCase();
        if (process.env[`${prefix}_CLIENT_ID`] && process.env[`${prefix}_CLIENT_SECRET`]) {
            providers[provider] = {
                clientId: requiredEnvironment(`${prefix}_CLIENT_ID`),
                clientSecret: requiredEnvironment(`${prefix}_CLIENT_SECRET`),
                overrideUserInfoOnSignIn: true,
            };
        }
    }
    // request only sign-in access without an offline refresh token
    if (providers.twitter) {
        providers.twitter.disableDefaultScope = true;
        providers.twitter.scope = ["users.read", "tweet.read", "users.email"];
    }

    return providers;
}
