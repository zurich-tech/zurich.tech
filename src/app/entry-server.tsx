import { site } from "./site";
import { createHandler, StartServer } from "@solidjs/start/server";
import { getRequestEvent } from "solid-js/web";
import type { JSX } from "solid-js";

import { themeInitializer } from "./theme";

// Send completed HTML so the initial page does not depend on streamed reveal scripts.
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
