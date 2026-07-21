import { createSignal } from "solid-js";

import { auth } from "../auth";
import { Button } from "../component/button";
import { Page, Section } from "../component/page";
import { Seo } from "../component/seo";

/** Sign-in page. */
export default function Route() {
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    // begin GitHub OAuth from the current site
    async function signIn() {
        setError(undefined);
        setIsPending(true);

        // request the provider redirect
        try {
            const origin = window.location.origin;
            const result = await auth.signIn.social({
                callbackURL: `${origin}/settings`,
                errorCallbackURL: `${origin}/sign-in?error=github`,
                provider: "github",
            });

            // surface provider errors when no redirect occurred
            if (result.error !== null) {
                setError(result.error.message ?? "GitHub sign-in failed.");
                setIsPending(false);
            }
        } catch (caught) {
            // surface transport failures
            const message = caught instanceof Error ? caught.message : "GitHub sign-in failed.";
            setError(message);
            setIsPending(false);
        }
    }

    return (
        <>
            <Seo title="sign in" description="Sign in to zurich.tech." />
            <Page width="narrow">
                {/* authentication */}
                <Section title="sign in">
                    <div class="auth-choice">
                        <Button disabled={isPending()} onClick={signIn} type="button">
                            {isPending() ? "opening github..." : "continue with github"}
                        </Button>
                        {error() !== undefined ? <p class="form-error">{error()}</p> : null}
                    </div>
                </Section>
            </Page>
        </>
    );
}
