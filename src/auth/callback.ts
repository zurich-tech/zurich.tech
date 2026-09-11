import { auth } from "./index";

/** Complete a cross-domain OAuth sign-in returned to the current page. */
export async function completeSignIn() {
    // extract the returned token and leave unrelated URL parameters intact
    const url = new URL(window.location.href);
    const token = url.searchParams.get("ott");
    if (!token) return;

    // remove the short lived token from browser history before exchanging it
    url.searchParams.delete("ott");
    window.history.replaceState({}, "", url);

    // exchange the token for a session cookie stored by the cross-domain client
    const verification = await auth.crossDomain.oneTimeToken.verify({ token });
    if (verification.error !== null) {
        throw new Error(verification.error.message ?? "Could not verify the OAuth session.");
    }

    // require the exchange to produce one concrete session
    const session = verification.data?.session;
    if (session === undefined) {
        throw new Error("OAuth authentication returned no session.");
    }

    // load and publish the session to existing Solid subscribers
    const result = await auth.getSession({
        fetchOptions: { headers: { Authorization: `Bearer ${session.token}` } },
    });
    if (result.error !== null) {
        throw new Error(result.error.message ?? "Could not load the OAuth session.");
    }
    auth.updateSession();
}
