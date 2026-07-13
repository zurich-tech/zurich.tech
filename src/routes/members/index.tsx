import { createAsync } from "@solidjs/router";
import { For, Show, createMemo, createSignal } from "solid-js";

import { DirectoryList, DirectoryRow } from "../../component/list";
import { Page, PageHeader, Section } from "../../component/page";
import { Seo } from "../../component/seo";
import { TableToolbar } from "../../component/toolbar";
import { getMembers, type PublicMember } from "../../data/public";

/** Member index. */
export default function Route() {
    // members
    const members = createAsync(() => getMembers());

    return (
        <>
            <Seo title="members" description="zurich.tech members." />
            <Page>
                <PageHeader title="members" />

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
        <Section
            meta={`${visible().length} / ${props.members.length}`}
            title="members"
            toolbar={<TableToolbar onSearch={setQuery} placeholder="search members..." />}
        >
            {/* empty */}
            <Show when={visible().length > 0} fallback={<p class="text-soft">no members</p>}>
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
        </Section>
    );
}
