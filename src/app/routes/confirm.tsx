import { Card } from "../../components/card";
import { Arrow } from "../../components/arrow";
import { useSearchParams } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import { publicClient } from "../../auth/convex";
import { Page } from "../page";
import { Seo } from "../seo";
import { FormMessage } from "../../components/form";
import { errorMessage } from "../../components/errors";

/** Confirm email ownership through an explicit action, safe from link scanners. */
export default function Route() {
    // retain the confirmation result for this private link
    const [params] = useSearchParams();
    const [success, setSuccess] = createSignal<string>();
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    /** Consume the verification link only after the recipient clicks. */
    async function confirm() {
        setIsPending(true);
        setError(undefined);
        try {
            if (typeof params.token !== "string")
                throw new Error("This link is missing its verification token.");
            setSuccess(
                await publicClient().mutation(api.mail.verification.confirm, {
                    token: params.token,
                }),
            );
        } catch (caught) {
            setError(errorMessage(caught, "Could not confirm."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <Seo title="Confirm your email" description="Confirm your zurich.tech email address." />
            <Page width="narrow">
                <Card title="Confirm your email" heading="h1">
                    <div class="confirmation-panel">
                        <Show when={!success() && typeof params.token === "string"}>
                            <p>Confirm your email to continue.</p>
                            <button
                                class="button button--primary"
                                disabled={isPending()}
                                onClick={confirm}
                            >
                                {isPending() ? "Confirming…" : "Confirm my email"}
                            </button>
                        </Show>
                        <Show when={!params.token}>
                            <p>Open the confirmation link from your email.</p>
                        </Show>
                        <FormMessage error={error()} success={success()} />
                        <a class="text-link" href="/events">
                            View events <Arrow direction="external" />
                        </a>
                    </div>
                </Card>
            </Page>
        </>
    );
}
