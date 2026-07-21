import { Match, Switch, createSignal, onMount } from "solid-js";

import { auth } from "../../auth";
import { Button } from "../../component/button";
import { DetailList, DetailRow, Page, Section } from "../../component/page";
import { Seo } from "../../component/seo";

/** Settings page. */
export default function Route() {
    const session = auth.useSession();
    const [error, setError] = createSignal<string>();
    const [isMounted, setIsMounted] = createSignal(false);
    const [isPending, setIsPending] = createSignal(false);

    // defer browser session state until hydration completes
    onMount(() => setIsMounted(true));
    const user = () => (isMounted() ? session().data?.user : undefined);
    const sessionError = () => (isMounted() ? session().error : undefined);
    const isLoading = () => !isMounted() || session().isPending;

    // end the current session
    async function signOut() {
        setError(undefined);
        setIsPending(true);

        // clear the session and return home
        try {
            const result = await auth.signOut();

            // leave after a confirmed sign-out
            if (result.error === null) {
                window.location.assign("/");
                return;
            }

            // surface provider errors
            setError(result.error.message ?? "Sign-out failed.");
        } catch (caught) {
            // surface transport failures
            const message = caught instanceof Error ? caught.message : "Sign-out failed.";
            setError(message);
        }

        setIsPending(false);
    }

    return (
        <>
            <Seo title="settings" description="zurich.tech settings." />
            <Page width="narrow">
                {/* account */}
                <Switch
                    fallback={
                        <Section title="account">
                            <Button href="/sign-in">sign in</Button>
                        </Section>
                    }
                >
                    {/* loading */}
                    <Match when={isLoading()}>
                        <Section title="account">loading...</Section>
                    </Match>

                    {/* failure */}
                    <Match when={sessionError()}>
                        {(error) => (
                            <Section title="account">
                                <p class="form-error">
                                    {error().message ?? "Could not load the account."}
                                </p>
                            </Section>
                        )}
                    </Match>

                    {/* session */}
                    <Match when={user()}>
                        {(user) => (
                            <Section title="account">
                                {/* identity */}
                                <DetailList>
                                    <DetailRow label="name" value={user().name} />
                                    <DetailRow label="email" value={user().email} />
                                </DetailList>

                                {/* actions */}
                                <div class="auth-choice">
                                    <Button
                                        disabled={isPending()}
                                        kind="ghost"
                                        onClick={signOut}
                                        type="button"
                                    >
                                        {isPending() ? "signing out..." : "sign out"}
                                    </Button>
                                    {error() !== undefined ? (
                                        <p class="form-error">{error()}</p>
                                    ) : null}
                                </div>
                            </Section>
                        )}
                    </Match>
                </Switch>
            </Page>
        </>
    );
}
