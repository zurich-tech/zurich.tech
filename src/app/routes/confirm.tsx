import { Card } from "../../components/card";
import { Arrow } from "../../components/arrow";
import { useSearchParams } from "@solidjs/router";
import { createSignal, createResource, Show } from "solid-js";
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
    const [verification, { refetch }] = createResource(
        () => (typeof params.token === "string" ? params.token : undefined),
        async (token) => publicClient().query(api.mail.verification.status, { token }),
    );
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
            await refetch();
        } catch (caught) {
            setError(errorMessage(caught, "Could not confirm."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <Seo
                title={
                    verification()?.status === "confirmed"
                        ? "Email confirmed"
                        : verification()?.purpose === "subscription"
                          ? "Confirm subscription"
                          : "Confirm email"
                }
                description="Confirm your zurich.tech email address."
            />
            <Page width="narrow">
                <Card
                    title={
                        verification()?.status === "confirmed"
                            ? "Email confirmed"
                            : verification()?.purpose === "subscription"
                              ? "Confirm subscription"
                              : "Confirm email"
                    }
                    heading="h1"
                >
                    <div class="confirmation-panel">
                        <Show
                            when={
                                !success() &&
                                verification()?.status === "pending" &&
                                !verification.loading &&
                                !verification.error
                            }
                        >
                            <button
                                class="button button--primary"
                                disabled={isPending()}
                                onClick={confirm}
                            >
                                {isPending()
                                    ? "Confirming…"
                                    : verification()?.purpose === "subscription"
                                      ? "Confirm subscription"
                                      : "Confirm email"}
                            </button>
                        </Show>
                        <Show when={!params.token}>
                            <p>Open the confirmation link from your email.</p>
                        </Show>
                        <Show when={verification.loading}>
                            <p role="status">Loading…</p>
                        </Show>
                        <Show when={!success() && verification()?.status === "confirmed"}>
                            <p>Email confirmed.</p>
                        </Show>
                        <Show when={verification()?.status === "expired"}>
                            <p>This link has expired. Request a new one.</p>
                        </Show>
                        <FormMessage
                            error={
                                error() ||
                                (verification.error
                                    ? errorMessage(
                                          verification.error,
                                          "Could not load verification.",
                                      )
                                    : undefined)
                            }
                            success={success()}
                        />
                        <a class="text-link" href="/events">
                            View events <Arrow direction="external" />
                        </a>
                    </div>
                </Card>
            </Page>
        </>
    );
}
