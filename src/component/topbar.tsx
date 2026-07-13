import { A } from "@solidjs/router";
import { For } from "solid-js";

import { CommandPalette } from "./command";
import { ThemeToggle } from "./theme";

const links = [
    { href: "/events", label: "events" },
    { href: "/series", label: "series" },
    { href: "/members", label: "members" },
    { href: "/blog", label: "blog" },
];

/** Site header. */
export function Topbar() {
    return (
        <header class="site-topbar">
            {/* layout */}
            <div class="site-topbar__body">
                {/* brand */}
                <A class="site-topbar__brand" href="/">
                    zurich.tech
                </A>

                {/* navigation */}
                <nav aria-label="Primary navigation" class="site-topbar__primary">
                    <For each={links}>
                        {(link) => (
                            <A
                                activeClass="site-topbar__link--active"
                                class="site-topbar__link"
                                href={link.href}
                            >
                                /{link.label}
                            </A>
                        )}
                    </For>
                </nav>

                {/* actions */}
                <div class="site-topbar__actions">
                    <CommandPalette />
                    <ThemeToggle />
                    <A class="site-topbar__account" href="/settings">
                        [sign in]
                    </A>
                </div>
            </div>
        </header>
    );
}
