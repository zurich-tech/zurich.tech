import { For } from "solid-js";

import { subscribe } from "../data/actions";

const links = [
    { href: "https://x.com/zurichai", label: "x" },
    { href: "https://www.linkedin.com/company/zurichai", label: "linkedin" },
    { href: "mailto:hello@zurich.tech", label: "email" },
];

/** Site footer. */
export function Footer() {
    // subscribe one address from the compact footer form
    async function submit(submitEvent: SubmitEvent) {
        submitEvent.preventDefault();

        const form = submitEvent.currentTarget as HTMLFormElement;
        const email = String(new FormData(form).get("email") ?? "");
        if (email.length === 0) {
            return;
        }

        await subscribe(email);
        form.reset();
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
                        type="email"
                    />
                    <button type="submit">[subscribe]</button>
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
