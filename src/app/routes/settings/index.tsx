import { Card } from "../../../components/card";
import { Match, Show, Switch, createSignal } from "solid-js";

import { PaymentHistory } from "../../../billing/payments";
import { ProfileSettings } from "../../../members/profile";
import { PatronSettings } from "../../../sponsorships/patrons";
import { auth, useAccount } from "../../../auth/index";
import { Button } from "../../../components/button";
import { DetailList, DetailRow, Page, PageHeader } from "../../page";
import { Seo } from "../../seo";
import { errorMessage } from "../../../components/errors";

/** Settings page. */
export default function Route() {
    const account = useAccount();
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    // end the current session
    async function signOut() {
        setError(undefined);
        setIsPending(true);

        // clear the session and return home
        try {
            const result = await auth.signOut();
            if (result.error === null) {
                window.location.assign("/");

                return;
            }

            setError(result.error.message ?? "Sign-out failed.");
        } catch (caught) {
            setError(errorMessage(caught, "Sign-out failed."));
        }

        setIsPending(false);
    }

    return (
        <>
            <Seo title="Settings" description="zurich.tech settings." />
            <Page width="narrow">
                <PageHeader title="Settings" />
                {/* account */}
                <Switch
                    fallback={
                        <Card title="Account">
                            <Button href="/sign-in">Sign in</Button>
                        </Card>
                    }
                >
                    {/* loading */}
                    <Match when={account.isPending()}>
                        <Card title="Account">Loading…</Card>
                    </Match>

                    {/* failure */}
                    <Match when={account.error()}>
                        {(accountError) => (
                            <Card title="Account">
                                <p class="form-error">
                                    {accountError().message ?? "Could not load the account."}
                                </p>
                            </Card>
                        )}
                    </Match>

                    {/* member */}
                    <Match when={account.user()}>
                        {(user) => (
                            <Card title="Account">
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
                                        {isPending() ? "Signing out…" : "Sign out"}
                                    </Button>
                                    <Show when={error()}>
                                        {(message) => <p class="form-error">{message()}</p>}
                                    </Show>
                                </div>
                            </Card>
                        )}
                    </Match>
                </Switch>
                <Show when={account.user()}>
                    <ProfileSettings />
                    <PatronSettings />
                    <PaymentHistory />
                </Show>
            </Page>
        </>
    );
}
