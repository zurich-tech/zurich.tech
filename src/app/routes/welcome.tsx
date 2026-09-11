import { createEffect, createResource, Show } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { api } from "../../../convex/_generated/api";
import { useAccount } from "../../auth";
import { memberClient } from "../../auth/convex";
import { Demographics } from "../../members/demographics";
import { Page, PageHeader } from "../page";
import { Seo } from "../seo";

/** Offer an optional community profile after the first sign-in. */
export default function Route() {
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
        window.location.assign(
            target.origin === window.location.origin && target.pathname !== "/welcome"
                ? target.pathname + target.search + target.hash
                : "/settings",
        );
    }
    createEffect(() => {
        if (current()?.onboardedAt) finish();
    });

    return (
        <>
            <Seo title="Welcome" description="Complete your optional community profile." />
            <Page width="narrow">
                <PageHeader title="Welcome" summary="Help us understand our community." />
                <Show
                    when={account.user()}
                    fallback={
                        <a class="button" href="/sign-in?next=%2Fwelcome">
                            Sign in
                        </a>
                    }
                >
                    <Show when={current() && !current()?.onboardedAt}>
                        <Demographics onComplete={finish} />
                    </Show>
                    <Show when={current.error}>
                        <p class="form-error">Could not load your profile.</p>
                        <a href="/settings">Continue to Account</a>
                    </Show>
                </Show>
            </Page>
        </>
    );
}
