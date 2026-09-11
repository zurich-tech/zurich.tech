import { getMembers, type PublicMember } from "../../../members/queries";
import { Card } from "../../../components/card";
import { createAsync } from "@solidjs/router";
import { For, Show, createMemo, createSignal } from "solid-js";

import { DirectoryList, DirectoryRow } from "../../../components/list";
import { Page, PageHeader } from "../../page";
import { Seo } from "../../seo";
import { TableToolbar } from "../../../components/toolbar";

/** Member index. */
export default function Route() {
    // members
    const members = createAsync(() => getMembers());

    return (
        <>
            <Seo title="Members" description="zurich.tech members." />
            <Page>
                <PageHeader title="Members" />

                {/* members */}
                <MemberDirectory members={members() ?? []} />
            </Page>
        </>
    );
}

/** Member directory. */
function MemberDirectory(props: { members: PublicMember[] }) {
    const [query, setQuery] = createSignal("");

    // filter visible members by their public profile text
    const visible = createMemo(() => {
        const text = query().trim().toLowerCase();
        if (text.length === 0) {
            return props.members;
        }

        return props.members.filter((member) =>
            `${member.name} ${member.handle} ${member.headline ?? ""} ${member.interests.join(" ")}`
                .toLowerCase()
                .includes(text),
        );
    });

    return (
        <Card
            meta={`${visible().length} / ${props.members.length}`}
            title="Profiles"
            toolbar={<TableToolbar onSearch={setQuery} placeholder="Search members" />}
        >
            {/* empty */}
            <Show
                when={visible().length > 0}
                fallback={<p class="text-soft">No public member profiles yet.</p>}
            >
                <DirectoryList>
                    <For each={visible()}>
                        {(member) => (
                            <DirectoryRow
                                eyebrow={`@${member.handle}`}
                                href={`/members/${member.handle}`}
                                summary={member.headline}
                                title={member.name}
                            />
                        )}
                    </For>
                </DirectoryList>
            </Show>
        </Card>
    );
}
