import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/solid";
import { createSignal, onMount } from "solid-js";

import { parseSignInCallback } from "./signin";

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

/** Complete a cross-domain OAuth sign-in returned to the current page. */
export async function completeSignIn() {
    const callback = parseSignInCallback(new URL(window.location.href));
    if (callback === null) {
        return;
    }

    // remove the short-lived token from browser history
    window.history.replaceState({}, "", callback.url);

    // exchange the token for a session cookie stored by the cross-domain client
    const verification = await auth.crossDomain.oneTimeToken.verify({ token: callback.token });
    if (verification.error !== null) {
        throw new Error(verification.error.message ?? "Could not verify the GitHub session.");
    }

    // require the exchange to produce one concrete session
    const session = verification.data?.session;
    if (session === undefined) {
        throw new Error("GitHub authentication returned no session.");
    }

    // load and publish the session to existing Solid subscribers
    const result = await auth.getSession({
        fetchOptions: { headers: { Authorization: `Bearer ${session.token}` } },
    });
    if (result.error !== null) {
        throw new Error(result.error.message ?? "Could not load the GitHub session.");
    }
    auth.updateSession();
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
