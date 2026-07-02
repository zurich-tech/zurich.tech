import type { JSX } from "solid-js";

import { Footer } from "./footer";
import { useKeys } from "./keys";
import { Topbar } from "./topbar";

/** Shell. */
export function Shell(props: { children?: JSX.Element }) {
    // global TUI keyboard
    useKeys();

    return (
        <div class="grid min-h-svh min-w-0 grid-rows-[auto_1fr_auto]">
            {/* status bars around the route */}
            <Topbar />
            <main class="min-h-0">{props.children}</main>
            <Footer />
        </div>
    );
}
