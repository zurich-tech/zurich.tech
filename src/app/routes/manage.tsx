import { useSearchParams } from "@solidjs/router";
import { For, Show } from "solid-js";
import { useAccount } from "../../auth";
import { Management } from "../../organisations/management";
import { Page } from "../page";
import { Card } from "../../components/card";
import { Seo } from "../seo";

/** Manage the signed-in member's organisations and purchases. */
export default function Route() {
    const account = useAccount();
    const [params, setParams] = useSearchParams();
    const section = () =>
        params.section === "jobs" || params.section === "sponsors"
            ? params.section
            : "organisations";

    return (
        <>
            <Seo title="Manage" description="Manage organisations, jobs and sponsorships." />
            <Page>
                <Card title="Manage" heading="h1" class="admin-navigation">
                    <nav class="filter-bar admin-tabs" aria-label="Management sections">
                        <For
                            each={[
                                { id: "organisations" as const, label: "Organisations" },
                                { id: "jobs" as const, label: "Jobs" },
                                { id: "sponsors" as const, label: "Sponsors" },
                            ]}
                        >
                            {(tab) => (
                                <button
                                    classList={{ active: section() === tab.id }}
                                    aria-pressed={section() === tab.id}
                                    onClick={() => setParams({ section: tab.id })}
                                >
                                    {tab.label}
                                </button>
                            )}
                        </For>
                    </nav>
                </Card>
                <Show
                    when={account.user()}
                    fallback={
                        <a class="button" href="/sign-in?next=%2Fmanage">
                            Sign in
                        </a>
                    }
                >
                    <Management section={section()} />
                </Show>
            </Page>
        </>
    );
}
