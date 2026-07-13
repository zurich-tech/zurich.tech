import type { JSX } from "solid-js";

import { Footer } from "./footer";
import { Topbar } from "./topbar";

/** Shell. */
export function Shell(props: { children?: JSX.Element }) {
    return (
        <div class="site-shell">
            {/* site */}
            <Topbar />
            <main class="site-main">{props.children}</main>
            <Footer />
        </div>
    );
}
