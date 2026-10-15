import { createResource, Show } from "solid-js";
import { useSearchParams, useLocation } from "@solidjs/router";
import { useAccount } from "../../../auth";
import { memberClient } from "../../../auth/convex";
import { api } from "../../../../convex/_generated/api";
import { NewsEditor } from "../../../news/editor";
import { Page } from "../../page";
import { Seo } from "../../seo";
import { Card } from "../../../components/card";
import { FormMessage } from "../../../components/form";
import { errorMessage } from "../../../components/errors";

/** Enforce team access before loading drafts or rendering editing controls. */
export default function Route() {
    const account = useAccount();
    const location = useLocation();
    const [params] = useSearchParams();
    const editorKey = () =>
        typeof params.id === "string" ? params.id : `new:${params.kind ?? "post"}`;
    const [workspace, { refetch }] = createResource(
        () => account.user()?.id,
        async () => (await memberClient()).query(api.news.queries.workspace, {}),
    );
    return (
        <>
            <Seo title="Edit news" description="Write and publish news." />
            <Page class="admin-content admin-editor-page">
                <Show when={workspace.error}>
                    <Card title="News">
                        <FormMessage
                            error={errorMessage(workspace.error, "Could not open the editor.")}
                        />
                        <button class="button" onClick={() => refetch()}>
                            Retry
                        </button>
                    </Card>
                </Show>
                <Show when={!account.isPending() && !account.user()}>
                    <Card title="News">
                        <a
                            class="button"
                            href={`/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`}
                        >
                            Sign in
                        </a>
                    </Card>
                </Show>
                <Show when={workspace()}>
                    {(data) => (
                        <Show when={editorKey()} keyed>
                            {(key) => {
                                const id = key.startsWith("new:") ? undefined : key;
                                return (
                                    <Show
                                        when={!id || data().posts.some((post) => post._id === id)}
                                        fallback={<Card title="News">Post not found.</Card>}
                                    >
                                        <NewsEditor
                                            workspace={data()}
                                            id={id}
                                            kind={params.kind === "link" ? "link" : "post"}
                                            onSave={async () => refetch()}
                                        />
                                    </Show>
                                );
                            }}
                        </Show>
                    )}
                </Show>
            </Page>
        </>
    );
}
