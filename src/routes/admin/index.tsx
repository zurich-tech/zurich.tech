import { For } from "solid-js";

import { DirectoryList, DirectoryRow } from "../../component/list";
import { Page, PageHeader, Section } from "../../component/page";
import { Seo } from "../../component/seo";

const queues = [
    { href: "/admin/events", summary: "proposals, rsvps, check-ins", title: "event review" },
    { href: "/admin/members", summary: "profiles, emails, roles", title: "members" },
    {
        href: "/admin/email",
        summary: "notifications, broadcasts, suppressions",
        title: "email",
    },
];

/** Admin index. */
export default function Route() {
    return (
        <>
            <Seo title="admin" description="zurich.tech admin." />
            <Page>
                <PageHeader title="admin" />

                {/* queues */}
                <Section title="queues" meta={`${queues.length}`}>
                    <DirectoryList>
                        <For each={queues}>
                            {(queue) => (
                                <DirectoryRow
                                    href={queue.href}
                                    summary={queue.summary}
                                    title={queue.title}
                                />
                            )}
                        </For>
                    </DirectoryList>
                </Section>
            </Page>
        </>
    );
}
