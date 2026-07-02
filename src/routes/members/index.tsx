import { createAsync } from "@solidjs/router";
import { For, Show } from "solid-js";

import { Page, PageHeader, Section } from "../../component/page";
import { Seo } from "../../component/seo";
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
    return (
        <Section title="members" meta={`${props.members.length}`}>
            {/* empty */}
            <Show when={props.members.length > 0} fallback={<p class="text-soft">nobody yet.</p>}>
                {/* rows */}
                <ol class="grid">
                    <For each={props.members}>{(member) => <MemberRow member={member} />}</For>
                </ol>
            </Show>
        </Section>
    );
}

/** Member row: handle, name, headline, inverted on hover. */
function MemberRow(props: { member: PublicMember }) {
    return (
        <li class="-mx-2 border-b border-line last:border-b-0">
            <a
                class="group grid gap-1 px-2 py-3 outline-none hover:bg-ink focus:bg-ink"
                href={`/members/${props.member.handle}`}
            >
                {/* handle and name */}
                <span class="flex flex-wrap items-baseline gap-3">
                    <span class="text-xs text-soft group-hover:text-paper/60 group-focus:text-paper/60">
                        @{props.member.handle}
                    </span>
                    <span class="font-medium group-hover:text-paper group-focus:text-paper">
                        {props.member.name}
                    </span>
                </span>

                {/* headline */}
                <Show when={props.member.headline}>
                    <span class="text-soft group-hover:text-paper/60 group-focus:text-paper/60">
                        {props.member.headline}
                    </span>
                </Show>
            </a>
        </li>
    );
}
