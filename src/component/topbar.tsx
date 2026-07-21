import { A } from "@solidjs/router";
import { For, Show, createSignal, onMount } from "solid-js";

import { auth } from "../auth";
import { CommandPalette } from "./command";
import { ThemeToggle } from "./theme";
import { Wordmark } from "./wordmark";

const links = [
    { href: "/events", label: "events" },
    { href: "/members", label: "members" },
    { href: "/news", label: "news" },
];

/** Site header. */
export function Topbar() {
    const session = auth.useSession();
    const [isMounted, setIsMounted] = createSignal(false);

    // defer browser session state until hydration completes
    onMount(() => setIsMounted(true));
    const user = () => (isMounted() ? session().data?.user : undefined);

    return (
        <header class="site-topbar">
            {/* layout */}
            <div class="site-topbar__body">
                {/* brand */}
                <A class="site-topbar__brand" href="/">
                    <Wordmark />
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

                    {/* account */}
                    <Show
                        when={user()}
                        fallback={
                            <A class="site-topbar__account" href="/sign-in">
                                [sign in]
                            </A>
                        }
                    >
                        <A class="site-topbar__account" href="/settings">
                            [account]
                        </A>
                    </Show>
                </div>
            </div>
        </header>
    );
}
