import { isModuleLoadError } from "./modules";
import { arrival } from "../statistics/arrival";
import { publicClient } from "../auth/convex";
import { api } from "../../convex/_generated/api";
import { PublicProvider } from "../data/context";
import { CatalogueProvider } from "../search/catalogue";
import { CommandProvider } from "../search/actions";
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
import "./tokens.css";
import "./base.css";
import "./frame.css";
import "../components/controls.css";
import "../components/card.css";
import "../components/statistics.css";
import "./workspace.css";

/** Keep the shared site layout mounted while routes load and change. */
export default function App() {
    return (
        <Router
            root={(props) => {
                const navigate = useNavigate();

                // count only the initial campaign landing, not subsequent client navigation
                onMount(() => {
                    const tags = arrival(new URL(window.location.href));
                    if (tags)
                        void publicClient()
                            .mutation(api.statistics.referrals.record, tags)
                            .catch((error: unknown) => {
                                console.error("Could not record campaign arrival.", error);
                            });
                });

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
                            <PublicProvider>
                                <CatalogueProvider>
                                    <CommandProvider>
                                        <Shell>
                                            <ConfirmationProvider>
                                                <ErrorBoundary
                                                    fallback={(error, reset) => {
                                                        console.error(
                                                            "Could not load page.",
                                                            error,
                                                        );
                                                        const isMissingModule =
                                                            isModuleLoadError(error);
                                                        return (
                                                            <Page>
                                                                <Card
                                                                    title={
                                                                        isMissingModule
                                                                            ? "Please reload this page"
                                                                            : "Could not load this page"
                                                                    }
                                                                    heading="h1"
                                                                >
                                                                    <p role="alert">
                                                                        {isMissingModule
                                                                            ? "A required page file could not be loaded. Reload to fetch the current version of the site."
                                                                            : "Please try again."}
                                                                    </p>
                                                                    <div class="row-actions">
                                                                        <button
                                                                            class="button"
                                                                            onClick={() =>
                                                                                isMissingModule
                                                                                    ? window.location.reload()
                                                                                    : reset()
                                                                            }
                                                                        >
                                                                            {isMissingModule
                                                                                ? "Reload page"
                                                                                : "Try again"}
                                                                        </button>
                                                                        <a
                                                                            class="button"
                                                                            href="/events"
                                                                            target="_self"
                                                                        >
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
                                    </CommandProvider>
                                </CatalogueProvider>
                            </PublicProvider>
                        </AccessProvider>
                    </MetaProvider>
                );
            }}
        >
            <FileRoutes />
        </Router>
    );
}
