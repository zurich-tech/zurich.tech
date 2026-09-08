import { createSignal, onMount } from "solid-js";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/solid";

/** Convex authentication endpoint. */
const siteUrl = convexSiteUrl();

/** Browser authentication client. */
export const auth = createAuthClient({
    baseURL: siteUrl,
    plugins: [convexClient(), crossDomainClient()],
});

/** Return hydration-safe account session state. */
export function useAccount() {
    const session = auth.useSession();
    const [isMounted, setIsMounted] = createSignal(false);

    // defer browser session state until hydration completes
    onMount(() => setIsMounted(true));
    const user = () => (isMounted() ? session().data?.user : undefined);
    const error = () => (isMounted() ? session().error : undefined);
    const isPending = () => !isMounted() || session().isPending;

    return { error, isPending, user };
}

/** Resolve the Convex HTTP endpoint from the configured deployment. */
function convexSiteUrl() {
    const explicitUrl = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
    if (explicitUrl !== undefined && explicitUrl.length > 0) {
        return explicitUrl;
    }

    // derive the paired HTTP endpoint used in deployed builds
    const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
    if (convexUrl !== undefined && convexUrl.endsWith(".convex.cloud")) {
        return convexUrl.replace(/\.convex\.cloud$/, ".convex.site");
    }

    throw new Error("VITE_CONVEX_SITE_URL is not configured.");
}
