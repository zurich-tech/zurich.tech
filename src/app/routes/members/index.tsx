import { useSearch } from "../../../search/local";
import { matchesSearch } from "../../../../convex/search/ranking";
import { affiliationText } from "../../../../convex/members/affiliations";
import { Highlight } from "../../../components/highlight";
import { Affiliations } from "../../../members/affiliations";
import { getMembers, type PublicMember } from "../../../members/queries";
import { Card } from "../../../components/card";
import { For, Show, createMemo } from "solid-js";

import { Avatar } from "../../../components/avatar";
import { DirectoryList } from "../../../components/list";
import { Page } from "../../page";
import { Contribute } from "../../contribute";
import { Seo } from "../../seo";
import { TableToolbar } from "../../../components/toolbar";
import "../../../members/members.css";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => getMembers(),
};

/** Member index. */
export default function Route() {
    // members
    const members = getMembers.use(() => []);

    return (
        <>
            <Seo title="Members" description="zurich.tech members." />
            <Page class="publication">
                <div class="listing-layout">
                    {/* members */}
                    <MemberDirectory members={members() ?? []} />

                    {/* invite people to add their own profile */}
                    <aside class="listing-sidebar">
                        <Card title="Join" class="offer-card">
                            <p>
                                Create a profile to appear here, register for events in one click
                                and get the weekly email.
                            </p>
                            <a class="button button--primary" href="/sign-in?next=%2Fsettings">
                                Create your profile
                            </a>
                        </Card>
                        <Contribute />
                    </aside>
                </div>
            </Page>
        </>
    );
}

/** Member directory. */
function MemberDirectory(props: { members: PublicMember[] }) {
    const { query, setQuery, terms } = useSearch();

    // filter visible members by their public profile text
    const visible = createMemo(() => {
        const text = query().trim().toLowerCase();
        if (text.length === 0) {
            return props.members;
        }

        return props.members.filter((member) =>
            matchesSearch(
                `${member.name} ${member.handle} ${member.headline ?? ""} ${affiliationText(member.affiliations) ?? ""}`,
                terms(),
            ),
        );
    });

    return (
        <Card title="Members" heading="h1" class="listing-card">
            <TableToolbar value={query()} onSearch={setQuery} placeholder="Search members…" />
            {/* empty */}
            <Show
                when={visible().length > 0}
                fallback={
                    <p class="empty-copy">
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
                                    <strong>
                                        <Highlight text={member.name} terms={terms()} />
                                    </strong>
                                    <Affiliations
                                        terms={terms()}
                                        values={member.affiliations}
                                        compact
                                    />
                                </span>
                            </a>
                        )}
                    </For>
                </DirectoryList>
            </Show>
        </Card>
    );
}
