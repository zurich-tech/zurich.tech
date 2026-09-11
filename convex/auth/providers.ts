import { requiredEnvironment } from "./environment";

/** Build only providers with both credentials configured on this deployment. */
export function socialProviders() {
    const providers: Partial<
        Record<
            "google" | "github",
            {
                clientId: string;
                clientSecret: string;
                overrideUserInfoOnSignIn: boolean;
            }
        >
    > = {};
    // enable each provider only when this deployment has its credentials
    for (const provider of ["google", "github"] as const) {
        const prefix = provider.toUpperCase();
        if (process.env[`${prefix}_CLIENT_ID`] && process.env[`${prefix}_CLIENT_SECRET`]) {
            providers[provider] = {
                clientId: requiredEnvironment(`${prefix}_CLIENT_ID`),
                clientSecret: requiredEnvironment(`${prefix}_CLIENT_SECRET`),
                overrideUserInfoOnSignIn: true,
            };
        }
    }
    return providers;
}
