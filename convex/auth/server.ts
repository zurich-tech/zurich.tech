import type { GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import { requiredEnvironment } from "../environment";
import { socialProviders } from "./providers";
import { authComponent } from "./component";

/** Create the Better Auth server for one Convex request. */
export function createAuth(ctx: GenericCtx<DataModel>) {
    const siteUrl = requiredEnvironment("SITE_URL");

    return betterAuth({
        baseURL: requiredEnvironment("CONVEX_SITE_URL"),
        database: authComponent.adapter(ctx),
        plugins: [crossDomain({ siteUrl }), convex({ authConfig })],
        socialProviders: socialProviders(),
        account: { accountLinking: { enabled: true, trustedProviders: ["github", "twitter"] } },
        trustedOrigins: [siteUrl, "http://localhost:3000"],
    });
}
