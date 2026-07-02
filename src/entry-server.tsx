import { createHandler, StartServer } from "@solidjs/start/server";
import type { JSX } from "solid-js";

export default createHandler(() => <StartServer document={Document} />);

function Document(props: { assets: JSX.Element; children?: JSX.Element; scripts: JSX.Element }) {
    return (
        <html lang="en">
            {/* head */}
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
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
