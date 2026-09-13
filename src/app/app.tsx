import { AccessProvider } from "../auth/edit";
import { ConfirmationProvider } from "../components/dialog";
import { Loading } from "../components/loading";
import { MetaProvider } from "@solidjs/meta";
import { Router, useNavigate } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { ErrorBoundary, Suspense, onMount } from "solid-js";
import { completeSignIn } from "../auth/callback";
import { Card } from "../components/card";
import { Page } from "./page";
import { Shell } from "./shell";
import "@fontsource-variable/archivo/standard.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "./style.css";

/** Keep the shared site layout mounted while routes load and change. */
export default function App() {
    return (
        <Router
            root={(props) => {
                const navigate = useNavigate();
                // complete OAuth inside the router so failures use client navigation
                onMount(() => {
                    void completeSignIn().catch((error: unknown) => {
                        console.error("Could not complete sign-in.", error);
                        navigate("/sign-in?error=callback", { replace: true });
                    });
                });

                return (
                    <MetaProvider>
                        <AccessProvider>
                            <Shell>
                                <ConfirmationProvider>
                                    <ErrorBoundary
                                        fallback={(error, reset) => {
                                            console.error("Could not load page.", error);
                                            return (
                                                <Page>
                                                    <Card
                                                        title="Could not load this page"
                                                        heading="h1"
                                                    >
                                                        <p role="alert">Please try again.</p>
                                                        <div class="row-actions">
                                                            <button class="button" onClick={reset}>
                                                                Try again
                                                            </button>
                                                            <a class="button" href="/events">
                                                                View events
                                                            </a>
                                                        </div>
                                                    </Card>
                                                </Page>
                                            );
                                        }}
                                    >
                                        <Suspense
                                            fallback={
                                                <Page>
                                                    <Loading />
                                                </Page>
                                            }
                                        >
                                            {props.children}
                                        </Suspense>
                                    </ErrorBoundary>
                                </ConfirmationProvider>
                            </Shell>
                        </AccessProvider>
                    </MetaProvider>
                );
            }}
        >
            <FileRoutes />
        </Router>
    );
}
