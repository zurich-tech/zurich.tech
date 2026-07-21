/** One returned OAuth session awaiting exchange. */
export type SignInCallback = {
    /** The URL without the one-time token. */
    url: URL;
    /** The one-time session token. */
    token: string;
};

/** Extract a returned OAuth token and its cleaned browser URL. */
export function parseSignInCallback(url: URL): SignInCallback | null {
    const token = url.searchParams.get("ott");
    if (token === null || token.length === 0) {
        return null;
    }

    // preserve unrelated location state while removing the secret
    const cleanUrl = new URL(url);
    cleanUrl.searchParams.delete("ott");

    return { token, url: cleanUrl };
}
