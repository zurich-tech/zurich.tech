import { SectionTabs } from "../../components/section-tabs";
import { Loading } from "../../components/loading";
import { useSearchParams } from "@solidjs/router";
import { Show } from "solid-js";
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
                    <SectionTabs
                        label="Management sections"
                        value={section()}
                        options={[
                            { id: "organisations", label: "Organisations" },
                            { id: "jobs", label: "Jobs" },
                            { id: "sponsors", label: "Sponsors" },
                        ]}
                        onChange={(section) => setParams({ section })}
                    />
                </Card>
                <Show
                    when={account.user()}
                    fallback={
                        <Show when={!account.isPending()} fallback={<Loading />}>
                            <a class="button" href="/sign-in?next=%2Fmanage">
                                Sign in
                            </a>
                        </Show>
                    }
                >
                    <Management
                        section={section()}
                        organisationId={
                            typeof params.organisation === "string"
                                ? params.organisation
                                : undefined
                        }
                    />
                </Show>
            </Page>
        </>
    );
}
