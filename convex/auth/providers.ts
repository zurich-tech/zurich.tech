import { requiredEnvironment } from "../environment";

/** Build only providers with both credentials configured on this deployment. */
export function socialProviders() {
    return {
        ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
            ? {
                  github: {
                      clientId: requiredEnvironment("GITHUB_CLIENT_ID"),
                      overrideUserInfoOnSignIn: true,
                      clientSecret: requiredEnvironment("GITHUB_CLIENT_SECRET"),
                  },
              }
            : {}),
        ...(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET
            ? {
                  twitter: {
                      clientId: requiredEnvironment("TWITTER_CLIENT_ID"),
                      overrideUserInfoOnSignIn: true,
                      clientSecret: requiredEnvironment("TWITTER_CLIENT_SECRET"),
                  },
              }
            : {}),
    };
}
