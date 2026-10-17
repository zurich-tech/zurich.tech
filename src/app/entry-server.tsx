import { site } from "./site";
import { createHandler, StartServer } from "@solidjs/start/server";
import { getRequestEvent } from "solid-js/web";
import type { JSX } from "solid-js";

import { themeInitializer } from "./theme";
import archivoFont from "@fontsource-variable/archivo/files/archivo-latin-standard-normal.woff2?url";
import monoFont from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url";

// send completed HTML so the initial page does not depend on streamed reveal scripts
export default createHandler(() => <StartServer document={Document} />, { mode: "async" });

/** Render the shared HTML document for a server request. */
function Document(props: { assets: JSX.Element; children?: JSX.Element; scripts: JSX.Element }) {
    const pathname = new URL(getRequestEvent()!.request.url).pathname;

    return (
        <html lang="en">
            {/* head */}
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="canonical" href={`${site.url}${pathname}`} />
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                {/* discover the two shared fonts before waiting for the stylesheet */}
                <link
                    rel="preload"
                    href={archivoFont}
                    as="font"
                    type="font/woff2"
                    crossorigin="anonymous"
                />
                <link
                    rel="preload"
                    href={monoFont}
                    as="font"
                    type="font/woff2"
                    crossorigin="anonymous"
                />
                <link
                    rel="preconnect"
                    href={import.meta.env.VITE_CONVEX_URL}
                    crossorigin="anonymous"
                />
                <script innerHTML={themeInitializer} />
                {props.assets}
            </head>

            {/* body */}
            <body>
                <div id="app">{props.children}</div>
                {props.scripts}
            </body>
        </html>
    );
}
