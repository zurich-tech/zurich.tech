import { getMembers, type PublicMember } from "../../../members/queries";
import { Card } from "../../../components/card";
import { createAsync } from "@solidjs/router";
import { For, Show, createMemo, createSignal } from "solid-js";

import { Avatar } from "../../../components/avatar";
import { DirectoryList } from "../../../components/list";
import { Page } from "../../page";
import { Seo } from "../../seo";
import { TableToolbar } from "../../../components/toolbar";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => getMembers(),
};

/** Member index. */
export default function Route() {
    // members
    const members = createAsync(() => getMembers());

    return (
        <>
            <Seo title="Members" description="zurich.tech members." />
            <Page>
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
        <Card title="Members" heading="h1">
            <TableToolbar onSearch={setQuery} placeholder="Search members…" />
            {/* empty */}
            <Show
                when={visible().length > 0}
                fallback={
                    <p class="text-soft">
                        {props.members.length ? "No matching members." : "No public profiles yet."}
                    </p>
                }
            >
                <DirectoryList>
                    <For each={visible()}>
                        {(member) => (
                            <a class="directory-row member-row" href={`/members/${member.handle}`}>
                                <Avatar
                                    name={member.name}
                                    image={member.avatarUrl}
                                    imageDark={member.avatarDarkUrl}
                                />
                                <span class="member-row__copy">
                                    <strong>{member.name}</strong>
                                    <Show when={member.headline}>
                                        <span class="text-soft">{member.headline}</span>
                                    </Show>
                                </span>
                            </a>
                        )}
                    </For>
                </DirectoryList>
            </Show>
        </Card>
    );
}
