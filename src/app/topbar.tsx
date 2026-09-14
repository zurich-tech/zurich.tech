import { CommandPalette } from "../search/command";
import { A, useLocation } from "@solidjs/router";
import { Show, For, createSignal, createEffect } from "solid-js";
import { useAccess } from "../auth/edit";
import { Avatar } from "../components/avatar";
import { site } from "./site";
import { Brand } from "./brand";
import { Dialog } from "../components/dialog";
import { ThemeToggle } from "./theme";

const destinations = ["About", "Events", "Jobs", "News", "Map", "Sponsor", "Stats"];

/** Navigate the community's public pages and organiser workspace. */
export function Topbar() {
    const { account, access: profile, current: currentProfile, refetch } = useAccess();
    const location = useLocation();
    const [isMenuOpen, setMenuOpen] = createSignal(false);

    // close navigation when the destination changes
    createEffect(() => {
        location.pathname;
        setMenuOpen(false);
    });
    return (
        <header class="site-topbar">
            <div class="site-topbar__body">
                <nav aria-label="Primary navigation" class="site-topbar__primary">
                    <A class="site-topbar__logo" href="/" aria-label="zurich.tech home">
                        <Brand />
                    </A>
                    <For each={destinations}>
                        {(name) => <A href={`/${name.toLowerCase()}`}>{name}</A>}
                    </For>
                </nav>
                <div class="site-topbar__actions">
                    <div class="header-links">
                        <a class="header-host" href="/contribute#events">
                            Suggest event
                        </a>
                        <a
                            class="header-host"
                            href={site.socials.discord}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Suggest news
                        </a>
                        <Show
                            when={account.user()}
                            fallback={
                                <Show
                                    when={!account.isPending()}
                                    fallback={
                                        <span
                                            class="header-pending"
                                            role="status"
                                            aria-label="Loading account"
                                        />
                                    }
                                >
                                    <A class="header-account" href="/sign-in">
                                        Sign in
                                    </A>
                                </Show>
                            }
                        >
                            <Show when={profile.error}>
                                <button
                                    class="header-account"
                                    title="Could not load account controls"
                                    onClick={() => void refetch()}
                                >
                                    Retry account
                                </button>
                            </Show>
                            <Show when={currentProfile()?.canManage}>
                                <A class="header-account header-admin" href="/admin">
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
                                    name={currentProfile()?.name ?? account.user()!.name}
                                    image={currentProfile()?.avatarUrl ?? account.user()?.image}
                                    imageDark={currentProfile()?.avatarDarkUrl}
                                />
                            </A>
                        </Show>
                    </div>
                    <ThemeToggle />
                    <CommandPalette />
                    <button
                        class="header-menu"
                        onClick={() => setMenuOpen(true)}
                        aria-label="Menu"
                        title="Menu"
                        aria-haspopup="dialog"
                        aria-expanded={isMenuOpen()}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="20"
                            height="20"
                            aria-hidden="true"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                        >
                            <path d="M5 7h14M5 12h14M5 17h14" />
                        </svg>
                    </button>
                </div>
            </div>
            <Dialog
                isOpen={isMenuOpen()}
                title="Menu"
                onClose={() => setMenuOpen(false)}
                actions={
                    <button class="button" onClick={() => setMenuOpen(false)}>
                        Close
                    </button>
                }
            >
                <nav
                    class="mobile-navigation"
                    aria-label="Site navigation"
                    onClick={(event) => {
                        if ((event.target as HTMLElement).closest("a")) setMenuOpen(false);
                    }}
                >
                    <For each={destinations}>
                        {(name) => <A href={`/${name.toLowerCase()}`}>{name}</A>}
                    </For>
                    <A href="/contribute#events">Suggest event</A>
                    <a href={site.socials.discord} target="_blank" rel="noopener noreferrer">
                        Suggest news
                    </a>
                    <Show when={currentProfile()?.canManage}>
                        <A href="/admin">Admin</A>
                    </Show>
                </nav>
            </Dialog>
        </header>
    );
}
