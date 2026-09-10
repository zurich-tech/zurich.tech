import { createSignal, For, Show } from "solid-js";
import { createAsync, useSearchParams } from "@solidjs/router";
import { getSignInProviders } from "../core/queries";
import { auth } from "../core/auth";
import { Page } from "../component/page";
import { Card } from "../component/card";
import { Seo } from "../component/seo";
import { FormMessage } from "../component/form";
import { errorMessage } from "../core/error";

/** Sign in with a verified GitHub or X identity. */
export default function Route() {
    const [params] = useSearchParams();
    const providers = createAsync(() => getSignInProviders(), { deferStream: true });
    const [pending, setPending] = createSignal<string>();
    const [error, setError] = createSignal<string>();

    /** Return to a local page after the provider completes authentication. */
    async function signIn(provider: "github" | "twitter") {
        setPending(provider);
        setError(undefined);
        const destination =
            typeof params.next === "string" &&
            params.next.startsWith("/") &&
            !params.next.startsWith("//") &&
            !params.next.includes("\\")
                ? params.next
                : "/admin";
        try {
            const result = await auth.signIn.social({
                provider,
                callbackURL: `${window.location.origin}${destination}`,
                errorCallbackURL: `${window.location.origin}/sign-in?error=provider`,
            });
            if (result.error) throw new Error(result.error.message);
        } catch (caught) {
            setError(errorMessage(caught, "Could not sign in."));
            setPending(undefined);
        }
    }

    return (
        <>
            <Seo title="Sign in" description="Sign in to publish events and jobs." />
            <Page class="sign-in-page">
                <Card title="Sign in" heading="h1" class="sign-in-card">
                    <div class="social-sign-in">
                        <For
                            each={[
                                {
                                    provider: "github" as const,
                                    label: "GitHub",
                                    icon: "M8 1a7 7 0 0 0-2.2 13.6v-1.7c-1.8.4-2.2-.8-2.2-.8-.3-.8-.8-1-1-1.1-.6-.4 0-.4 0-.4.7 0 1 .7 1 .7.6 1 1.5.7 2.2.5.1-.4.3-.7.5-.9-1.5-.2-3.1-.7-3.1-3.4 0-.7.2-1.3.7-1.8-.1-.2-.3-.9.1-1.8 0 0 .6-.2 1.9.7a6.5 6.5 0 0 1 3.5 0c1.3-.9 1.9-.7 1.9-.7.4.9.2 1.6.1 1.8.5.5.7 1.1.7 1.8 0 2.7-1.6 3.2-3.1 3.4.3.2.5.6.5 1.2v2.5A7 7 0 0 0 8 1Z",
                                },
                                {
                                    provider: "twitter" as const,
                                    label: "X",
                                    icon: "M2 2h3l9 12h-3L2 2Zm11 0h1L3 14H2L13 2Z",
                                },
                            ].filter((item) => providers()?.includes(item.provider))}
                        >
                            {(item) => (
                                <button
                                    class="button"
                                    disabled={pending() !== undefined}
                                    onClick={() => signIn(item.provider)}
                                >
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 16 16"
                                        fill="currentColor"
                                        aria-hidden="true"
                                    >
                                        <path d={item.icon} />
                                    </svg>
                                    {pending() === item.provider
                                        ? "Connecting…"
                                        : `Continue with ${item.label}`}
                                </button>
                            )}
                        </For>
                    </div>
                    <Show when={providers()?.length === 0}>
                        <p class="text-soft">
                            Sign-in is not available yet. Please try again later.
                        </p>
                    </Show>
                    <Show when={params.error}>
                        <p class="form-error">
                            Sign-in wasn’t completed. Please try again with an account that has a
                            verified email address.
                        </p>
                    </Show>
                    <FormMessage error={error()} />
                </Card>
            </Page>
        </>
    );
}
