import { Show, createEffect, onMount, type JSX } from "solid-js";
import { useLocation } from "@solidjs/router";
import { Hero } from "./hero";

import { Footer } from "./footer";
import { Topbar } from "./topbar";

/** Shell. */
export function Shell(props: { children?: JSX.Element }) {
    const location = useLocation();

    // update the document-owned canonical link during client navigation
    onMount(() => {
        const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!canonical) throw new Error("The document is missing its canonical link.");
        createEffect(() => {
            canonical.href = `https://zurich.tech${location.pathname}`;
        });
    });

    return (
        <div class="site-shell">
            {/* site */}
            <Topbar />
            <main
                class="site-main"
                classList={{ "site-main--centered": location.pathname === "/sign-in" }}
            >
                <Show
                    when={
                        location.pathname !== "/" &&
                        location.pathname !== "/map" &&
                        location.pathname !== "/photos" &&
                        location.pathname !== "/sign-in"
                    }
                >
                    <Hero isCompact />
                </Show>
                {props.children}
            </main>
            <Footer />
        </div>
    );
}
