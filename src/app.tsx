import { MetaProvider } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, onMount } from "solid-js";

import { completeSignIn } from "./auth";
import { Shell } from "./component/shell";
import "./style.css";

/** Site application. */
export default function App() {
    // complete an OAuth session returned by the Convex authentication endpoint
    onMount(() => {
        void completeSignIn().catch((error: unknown) => {
            console.error("Could not complete sign-in.", error);
            window.location.assign("/sign-in?error=callback");
        });
    });

    return (
        <Router
            root={(props) => (
                <MetaProvider>
                    {/* route suspense */}
                    <Suspense>
                        <Shell>{props.children}</Shell>
                    </Suspense>
                </MetaProvider>
            )}
        >
            {/* routes */}
            <FileRoutes />
        </Router>
    );
}
