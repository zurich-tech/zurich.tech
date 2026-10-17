import { FormMessage, leaveEditor, resetEditor } from "../../../components/form";
import { Speaking } from "../../../events/speaking";
import { SectionTabs } from "../../../components/section-tabs";
import { useLocation, useNavigate, useSearchParams } from "@solidjs/router";
import { Loading } from "../../../components/loading";
import { Card } from "../../../components/card";
import { Match, Show, Switch, createSignal } from "solid-js";

import { PaymentHistory } from "../../../billing/payments";
import { Notifications } from "../../../members/notifications";
import { ProfileSettings } from "../../../members/profile";
import { SupportSettings } from "../../../sponsorships/members";
import { auth, useAccount } from "../../../auth/index";
import { Button } from "../../../components/button";
import { Page, PageHeader } from "../../page";
import { Seo } from "../../seo";
import { errorMessage } from "../../../components/errors";
import "../../../members/profile.css";

/** Settings page. */
export default function Route() {
    const navigate = useNavigate();
    const account = useAccount();
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const sections = [
        { id: "profile", label: "Profile" },
        { id: "notifications", label: "Notifications" },
        { id: "speaking", label: "Speaking" },
        { id: "billing", label: "Billing" },
    ];
    const section = () =>
        sections.some((item) => item.id === params.section)
            ? String(params.section)
            : location.hash === "#notifications"
              ? "notifications"
              : "profile";

    /** Let the editor's navigation guard protect section changes. */
    function selectSection(id: string) {
        setParams({ section: id });
    }
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    // end the current session
    /** Resolve unsaved changes before clearing the session. */
    async function signOut() {
        if (!(await leaveEditor())) return;
        setError(undefined);
        setIsPending(true);

        // clear the session and return home
        try {
            const result = await auth.signOut();
            if (result.error === null) {
                Array.from(document.forms).forEach(resetEditor);
                navigate("/", { replace: true });

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
            <Seo title="Account" description="Your zurich.tech profile and email preferences." />
            <Page class="account-page publication">
                <PageHeader
                    title="Account"
                    actions={
                        <Show when={account.user()}>
                            <Button
                                disabled={isPending()}
                                kind="ghost"
                                onClick={signOut}
                                type="button"
                            >
                                {isPending() ? "Signing out…" : "Sign out"}
                            </Button>
                        </Show>
                    }
                />
                <Show when={error()}>
                    <FormMessage error={error()} />
                </Show>
                <Switch
                    fallback={
                        <Card title="Profile">
                            <Button href="/sign-in">Sign in</Button>
                        </Card>
                    }
                >
                    <Match when={account.isPending()}>
                        <Card title="Profile">
                            <Loading />
                        </Card>
                    </Match>
                    <Match when={account.error()}>
                        <FormMessage error="Could not load your account." />
                    </Match>
                    <Match when={account.user()}>
                        <SectionTabs
                            label="Account sections"
                            options={sections}
                            value={section()}
                            onChange={selectSection}
                        />
                        <div class="account-workspace">
                            <Switch>
                                <Match when={section() === "profile"}>
                                    <ProfileSettings />
                                </Match>
                                <Match when={section() === "speaking"}>
                                    <Speaking />
                                </Match>
                                <Match when={section() === "notifications"}>
                                    <Notifications />
                                </Match>
                                <Match when={section() === "billing"}>
                                    <Card title="Billing">
                                        <SupportSettings />
                                        <PaymentHistory />
                                    </Card>
                                </Match>
                            </Switch>
                        </div>
                    </Match>
                </Switch>
            </Page>
        </>
    );
}
