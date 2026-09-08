import { A } from "@solidjs/router";
import { Show } from "solid-js";
import { useAccount } from "../core/auth";
import { Avatar } from "./avatar";
import { Wordmark } from "./wordmark";
import { ThemeToggle } from "./theme";
import logo from "../assets/logo.svg?raw";

/** Navigate the community's public pages and organiser workspace. */
export function Topbar() {
    const account = useAccount();

    return (
        <header class="site-topbar">
            <div class="site-topbar__body">
                <nav aria-label="Primary navigation" class="site-topbar__primary">
                    <A class="site-topbar__logo" href="/" aria-label="zurich.tech home">
                        <Wordmark />
                        <span class="site-symbol" innerHTML={logo} />
                    </A>
                    <A href="/events">Events</A>
                    <A href="/news">News</A>
                    <A href="/jobs">Jobs</A>
                </nav>
                <div class="site-topbar__actions">
                    <div class="header-links">
                        <A class="header-host" href="/submit">
                            Submit event
                        </A>
                        <Show
                            when={account.user()}
                            fallback={
                                <A class="header-account" href="/sign-in">
                                    Sign in
                                </A>
                            }
                        >
                            <A
                                class="header-account header-avatar"
                                href="/admin"
                                aria-label="Your workspace"
                                title={account.user()?.name}
                            >
                                <Avatar name={account.user()!.name} image={account.user()?.image} />
                            </A>
                        </Show>
                    </div>
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
