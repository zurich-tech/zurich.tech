import { A } from "@solidjs/router";
import { For, Match, Switch } from "solid-js";

import { useAccount } from "../auth";
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
    const account = useAccount();

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
                    <Switch
                        fallback={
                            <A class="site-topbar__account" href="/sign-in">
                                [sign in]
                            </A>
                        }
                    >
                        {/* loading */}
                        <Match when={account.isPending()}>
                            <span class="site-topbar__account site-topbar__account--pending">
                                [account]
                            </span>
                        </Match>

                        {/* failure */}
                        <Match when={account.error()}>
                            <A class="site-topbar__account" href="/settings">
                                [account!]
                            </A>
                        </Match>

                        {/* session */}
                        <Match when={account.user()}>
                            {(user) => (
                                <A
                                    class="site-topbar__account"
                                    href="/settings"
                                    title={user().email}
                                >
                                    [{user().name}]
                                </A>
                            )}
                        </Match>
                    </Switch>
                </div>
            </div>
        </header>
    );
}
