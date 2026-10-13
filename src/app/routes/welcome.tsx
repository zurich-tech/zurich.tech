import { FormMessage } from "../../components/form";
import { Loading } from "../../components/loading";
import { createEffect, createResource, Show } from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { api } from "../../../convex/_generated/api";
import { useAccount } from "../../auth";
import { memberClient } from "../../auth/convex";
import { Survey } from "../../members/survey";
import { Page, PageHeader } from "../page";
import { Seo } from "../seo";

/** Offer an optional community profile after the first sign-in. */
export default function Route() {
    const navigate = useNavigate();
    const account = useAccount();
    const [params] = useSearchParams();
    const [current] = createResource(
        () => account.user()?.id,
        async () => (await memberClient()).query(api.members.audience.current, {}),
    );
    function finish() {
        const target = new URL(
            typeof params.next === "string" ? params.next : "/settings",
            window.location.origin,
        );
        navigate(
            target.origin === window.location.origin && target.pathname !== "/welcome"
                ? target.pathname + target.search + target.hash
                : "/settings",
            { replace: true },
        );
    }
    createEffect(() => {
        if (!current.error && current() && (current()?.onboardedAt || params.next === "/survey"))
            finish();
    });

    return (
        <>
            <Seo title="Welcome" description="Complete your optional community profile." />
            <Page class="survey-page">
                <PageHeader title="Welcome" summary="Help us make better events for everyone." />
                <Show
                    when={account.user()}
                    fallback={
                        <Show when={!account.isPending()} fallback={<Loading />}>
                            <a class="button" href="/sign-in?next=%2Fwelcome">
                                Sign in
                            </a>
                        </Show>
                    }
                >
                    <Show when={current.loading}>
                        <Loading />
                    </Show>
                    <Show when={!current.error && current() && !current()?.onboardedAt}>
                        <Survey onComplete={finish} />
                    </Show>
                    <Show when={current.error}>
                        <FormMessage error="Could not load your profile." />
                        <a href="/settings">Continue to Account</a>
                    </Show>
                </Show>
            </Page>
        </>
    );
}
