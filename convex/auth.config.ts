import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";

/** Convex JWT providers. */
const config = {
    providers: [getAuthConfigProvider()],
} satisfies AuthConfig;

export default config;
