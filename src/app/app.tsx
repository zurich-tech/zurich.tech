import { MetaProvider } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { ErrorBoundary, Suspense, onMount } from "solid-js";

import { completeSignIn } from "../auth/callback";
import { Card } from "../components/card";
import { Page } from "./page";
import { Shell } from "./shell";
import "@fontsource-variable/archivo/standard.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
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
                    <ErrorBoundary
                        fallback={(error, reset) => (
                            <Shell>
                                <Page>
                                    <Card title="Could not load this page" heading="h1">
                                        <p role="alert">
                                            {error instanceof Error ? error.message : String(error)}
                                        </p>
                                        <button class="button" onClick={reset}>
                                            Try again
                                        </button>
                                        <a href="/">Back to events</a>
                                    </Card>
                                </Page>
                            </Shell>
                        )}
                    >
                        <Suspense>
                            <Shell>{props.children}</Shell>
                        </Suspense>
                    </ErrorBoundary>
                </MetaProvider>
            )}
        >
            {/* routes */}
            <FileRoutes />
        </Router>
    );
}
