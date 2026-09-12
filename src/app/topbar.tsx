import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { A, useLocation } from "@solidjs/router";
import { Show, createResource } from "solid-js";
import { useAccount } from "../auth/index";
import { Avatar } from "../components/avatar";
import { Wordmark } from "./wordmark";
import { ThemeToggle } from "./theme";
import logo from "../components/assets/logo.svg?raw";

/** Navigate the community's public pages and organiser workspace. */
export function Topbar() {
    const account = useAccount();
    const location = useLocation();
    const [profile] = createResource(
        () => (account.user() ? `${account.user()!.id}:${location.pathname}` : undefined),
        async () => (await memberClient()).query(api.auth.queries.current, {}),
    );

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
                    <A href="/sponsor">Sponsor</A>
                    <A href="/about">About</A>
                    <A href="/map">Map</A>
                    <A href="/stats">Stats</A>
                </nav>
                <div class="site-topbar__actions">
                    <div class="header-links">
                        <a class="header-host" href="/contribute#events">
                            Suggest an event
                        </a>
                        <Show
                            when={account.user()}
                            fallback={
                                <A class="header-account" href="/sign-in">
                                    Sign in
                                </A>
                            }
                        >
                            <Show when={profile()?.isTeam}>
                                <A class="header-account" href="/admin">
                                    Admin
                                </A>
                            </Show>
                            <A
                                class="header-account header-avatar"
                                href="/settings"
                                aria-label="Your account"
                                title={account.user()?.name}
                            >
                                <Avatar
                                    name={profile()?.name ?? account.user()!.name}
                                    image={profile()?.avatarUrl ?? account.user()?.image}
                                    imageDark={profile()?.avatarDarkUrl}
                                />
                            </A>
                        </Show>
                    </div>
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
