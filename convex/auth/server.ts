import type { GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import { requiredEnvironment } from "../environment";
import { authComponent } from "./component";

/** Create the Better Auth server for one Convex request. */
export function createAuth(ctx: GenericCtx<DataModel>) {
    const siteUrl = requiredEnvironment("SITE_URL");

    return betterAuth({
        baseURL: requiredEnvironment("CONVEX_SITE_URL"),
        database: authComponent.adapter(ctx),
        plugins: [crossDomain({ siteUrl }), convex({ authConfig })],
        socialProviders: {
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
        },
        account: { accountLinking: { enabled: true, trustedProviders: ["github", "twitter"] } },
        trustedOrigins: [siteUrl, "http://localhost:3000"],
    });
}
