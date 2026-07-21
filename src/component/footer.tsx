import { For, createSignal } from "solid-js";

import { subscribe } from "../data/actions";
import { errorMessage } from "../error";
import { FormMessage } from "./form";

const links = [
    { href: "https://x.com/zurichai", label: "x" },
    { href: "https://www.linkedin.com/company/zurichai", label: "linkedin" },
    { href: "mailto:hello@zurich.tech", label: "email" },
];

/** Site footer. */
export function Footer() {
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);
    const [success, setSuccess] = createSignal<string>();

    // subscribe one address from the compact footer form
    async function submit(submitEvent: SubmitEvent) {
        submitEvent.preventDefault();

        const form = submitEvent.currentTarget as HTMLFormElement;
        const email = String(new FormData(form).get("email") ?? "");

        // expose the exact subscription result
        setError(undefined);
        setSuccess(undefined);
        setIsPending(true);
        try {
            await subscribe(email);
            form.reset();
            setSuccess("subscribed.");
        } catch (caught) {
            setError(errorMessage(caught, "subscription failed."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <footer class="site-footer">
            {/* layout */}
            <div class="site-footer__body">
                <p class="site-footer__copyright">(c) zurich.tech</p>

                {/* newsletter */}
                <form class="site-footer__newsletter" onSubmit={submit}>
                    <input
                        aria-label="newsletter email"
                        name="email"
                        placeholder="email"
                        required
                        type="email"
                    />
                    <button disabled={isPending()} type="submit">
                        [{isPending() ? "subscribing..." : "subscribe"}]
                    </button>
                    <FormMessage error={error()} success={success()} />
                </form>

                {/* links */}
                <nav aria-label="Community links">
                    <For each={links}>
                        {(link) => (
                            <a href={link.href} rel="noreferrer" target="_blank">
                                /{link.label}
                            </a>
                        )}
                    </For>
                </nav>
            </div>
        </footer>
    );
}
