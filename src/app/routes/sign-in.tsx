import { createSignal, For, Show } from "solid-js";
import { createAsync, useSearchParams } from "@solidjs/router";
import { getSignInProviders } from "../../auth/queries";
import { auth, useAccount } from "../../auth/index";
import { Page } from "../page";
import { Card } from "../../components/card";
import { Seo } from "../seo";
import { FormMessage } from "../../components/form";
import { errorMessage } from "../../components/errors";

/** Sign in with a social account or a one-time email code. */
export default function Route() {
    const account = useAccount();
    const [params] = useSearchParams();
    const providers = createAsync(() => getSignInProviders(), { deferStream: true });
    const [pending, setPending] = createSignal<string>();
    const [error, setError] = createSignal<string>();

    const [email, setEmail] = createSignal("");
    const [code, setCode] = createSignal("");
    const [isCodeSent, setCodeSent] = createSignal(false);

    /** Return only to a local page after authentication. */
    function destination() {
        // resolve browser URL normalization before allowing a local destination
        if (typeof params.next !== "string" || !params.next.startsWith("/")) return "/settings";
        const destination = new URL(params.next, window.location.origin);

        return destination.origin === window.location.origin
            ? `${destination.pathname}${destination.search}${destination.hash}`
            : "/settings";
    }

    /** Send a code or verify the submitted code without creating a password. */
    async function emailSignIn(event: SubmitEvent) {
        event.preventDefault();
        if (pending()) return;
        setPending("email");
        setError(undefined);
        try {
            if (isCodeSent()) {
                const result = await auth.signIn.emailOtp({
                    email: email().trim(),
                    otp: code().trim(),
                });
                if (result.error) {
                    const messages: Record<string, string> = {
                        INVALID_OTP: "That code is incorrect. Please try again.",
                        OTP_EXPIRED: "That code has expired. Please request a new one.",
                        TOO_MANY_ATTEMPTS: "Too many attempts. Please request a new code.",
                    };
                    throw new Error(
                        messages[result.error.code ?? ""] ??
                            "Could not verify the code. Please try again.",
                    );
                }
                window.location.assign(`/welcome?next=${encodeURIComponent(destination())}`);
            } else {
                const result = await auth.emailOtp.sendVerificationOtp({
                    email: email().trim(),
                    type: "sign-in",
                });
                if (result.error) throw new Error(result.error.message);
                setCodeSent(true);
            }
        } catch (caught) {
            setError(errorMessage(caught, "Could not sign in. Please try again."));
        } finally {
            setPending(undefined);
        }
    }

    /** Return to a local page after the provider completes authentication. */
    async function signIn(provider: "google" | "github") {
        setPending(provider);
        setError(undefined);
        try {
            const result = await auth.signIn.social({
                provider,
                callbackURL: `${window.location.origin}/welcome?next=${encodeURIComponent(destination())}`,
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
            <Seo
                title={account.user() ? "Signed in" : "Sign in"}
                description="Sign in to publish events and jobs."
            />
            <Page class="sign-in-page">
                <Card
                    title={account.user() ? "Signed in" : "Sign in"}
                    heading="h1"
                    class="sign-in-card"
                >
                    <Show when={!account.isPending()} fallback={<p role="status">Loading…</p>}>
                        <Show
                            when={!account.user()}
                            fallback={
                                <a class="button button--primary" href={destination()}>
                                    Continue
                                </a>
                            }
                        >
                            <div class="social-sign-in">
                                <For
                                    each={[
                                        {
                                            provider: "google" as const,
                                            label: "Google",
                                            icon: "M14.5 8.2c0-.5 0-.9-.1-1.4H8v2.6h3.7c-.2.9-.7 1.6-1.5 2.1v1.7h2.3c1.3-1.2 2-2.9 2-5ZM8 15c1.9 0 3.5-.6 4.6-1.7l-2.3-1.8c-.6.4-1.4.6-2.3.6-1.8 0-3.4-1.2-3.9-2.8H1.7v1.8A7 7 0 0 0 8 15ZM4.1 9.3a4.2 4.2 0 0 1 0-2.6V4.9H1.7a7 7 0 0 0 0 6.2l2.4-1.8ZM8 3.9c1 0 1.9.3 2.6 1l2-2A6.7 6.7 0 0 0 8 1a7 7 0 0 0-6.3 3.9l2.4 1.8C4.6 5.1 6.2 3.9 8 3.9Z",
                                        },
                                        {
                                            provider: "github" as const,
                                            label: "GitHub",
                                            icon: "M8 1a7 7 0 0 0-2.2 13.6v-1.7c-1.8.4-2.2-.8-2.2-.8-.3-.8-.8-1-1-1.1-.6-.4 0-.4 0-.4.7 0 1 .7 1 .7.6 1 1.5.7 2.2.5.1-.4.3-.7.5-.9-1.5-.2-3.1-.7-3.1-3.4 0-.7.2-1.3.7-1.8-.1-.2-.3-.9.1-1.8 0 0 .6-.2 1.9.7a6.5 6.5 0 0 1 3.5 0c1.3-.9 1.9-.7 1.9-.7.4.9.2 1.6.1 1.8.5.5.7 1.1.7 1.8 0 2.7-1.6 3.2-3.1 3.4.3.2.5.6.5 1.2v2.5A7 7 0 0 0 8 1Z",
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
                            <Show when={providers()?.includes("email")}>
                                <form class="email-sign-in" onSubmit={emailSignIn}>
                                    <label for="sign-in-email">Email</label>
                                    <input
                                        id="sign-in-email"
                                        type="email"
                                        autocomplete="email"
                                        required
                                        value={email()}
                                        disabled={isCodeSent() || pending() !== undefined}
                                        onInput={(event) => setEmail(event.currentTarget.value)}
                                    />
                                    <Show when={isCodeSent()}>
                                        <p class="text-soft">
                                            We sent a code to {email()}. It expires in 10 minutes.
                                        </p>
                                        <label for="sign-in-code">Code</label>
                                        <input
                                            id="sign-in-code"
                                            type="text"
                                            inputmode="numeric"
                                            autocomplete="one-time-code"
                                            pattern="[0-9]{6}"
                                            minlength={6}
                                            maxlength={6}
                                            required
                                            disabled={pending() !== undefined}
                                            value={code()}
                                            onInput={(event) => setCode(event.currentTarget.value)}
                                        />
                                    </Show>
                                    <button
                                        class="button button--primary"
                                        type="submit"
                                        disabled={pending() !== undefined}
                                    >
                                        {pending() === "email"
                                            ? "Please wait…"
                                            : isCodeSent()
                                              ? "Sign in"
                                              : "Continue with email"}
                                    </button>
                                    <Show when={isCodeSent()}>
                                        <button
                                            class="button button--ghost"
                                            type="button"
                                            disabled={pending() !== undefined}
                                            onClick={() => {
                                                setCodeSent(false);
                                                setCode("");
                                                setError(undefined);
                                            }}
                                        >
                                            Change email or request a new code
                                        </button>
                                    </Show>
                                </form>
                            </Show>
                            <Show when={providers()?.length === 0}>
                                <p class="text-soft">
                                    Sign-in is not available yet. Please try again later.
                                </p>
                            </Show>
                            <Show when={params.error}>
                                <p class="form-error">
                                    Sign-in wasn’t completed. Please try again with an account that
                                    has a verified email address.
                                </p>
                            </Show>
                            <FormMessage error={error()} />
                        </Show>
                    </Show>
                </Card>
            </Page>
        </>
    );
}
