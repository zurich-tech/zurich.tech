import type { GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { emailOTP } from "better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import { requiredEnvironment } from "./environment";
import { send } from "../mail/deliveries";
import { socialProviders } from "./providers";
import { authComponent } from "./component";

/** Create the Better Auth server for one Convex request. */
export function createAuth(ctx: GenericCtx<DataModel>) {
    const siteUrl = requiredEnvironment("SITE_URL");

    return betterAuth({
        baseURL: requiredEnvironment("CONVEX_SITE_URL"),
        database: authComponent.adapter(ctx),
        plugins: [
            crossDomain({ siteUrl }),
            convex({ authConfig }),
            emailOTP({
                storeOTP: "hashed",
                expiresIn: 600,
                allowedAttempts: 5,
                async sendVerificationOTP({ email, otp, type }) {
                    if (type !== "sign-in" && type !== "email-verification")
                        throw new Error("Unsupported email action.");
                    await send({
                        to: email,
                        subject: "Your zurich.tech sign-in code",
                        text: `Your zurich.tech code is ${otp}.\n\nIt expires in 10 minutes. If you did not request this code, you can ignore this email.`,
                        key: `auth-${crypto.randomUUID()}`,
                    });
                },
            }),
        ],
        rateLimit: { enabled: true, storage: "database" },
        socialProviders: socialProviders(),
        account: { accountLinking: { enabled: true } },
        trustedOrigins: [siteUrl, "http://localhost:3000"],
    });
}
