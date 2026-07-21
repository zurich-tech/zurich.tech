import { createAsync, useParams } from "@solidjs/router";
import { For, Match, Show, Switch } from "solid-js";

import { DirectoryList, DirectoryRow } from "../../component/list";
import { ExternalLinks, Tags } from "../../component/meta";
import { NotFound } from "../../component/notfound";
import { DetailList, DetailRow, Page, PageHeader, Section } from "../../component/page";
import { Seo } from "../../component/seo";
import { getMember, type CalendarEntry, type PublicMember } from "../../data/public";
import { routeParam } from "../../route";

/** Member profile. */
export default function Route() {
    // route params
    const params = useParams();
    const handle = routeParam("handle", params.handle);

    // member
    const member = createAsync(() => getMember(handle), { deferStream: true });
    const title = () => member()?.name ?? `@${handle}`;

    return (
        <Switch>
            {/* missing */}
            <Match when={member() === null}>
                <NotFound />
            </Match>

            {/* member */}
            <Match when={member() !== undefined}>
                <>
                    <Seo title={title()} description={`@${handle} on zurich.tech.`} />
                    <Page>
                        <PageHeader
                            summary={member()?.headline ?? "member not found."}
                            title={title()}
                        />

                        {/* profile */}
                        <div class="grid gap-8 lg:grid-cols-[1fr_18rem]">
                            <HostedEvents events={member()?.hostedEvents ?? []} />
                            <ProfileSections handle={handle} member={member()} />
                        </div>
                    </Page>
                </>
            </Match>
        </Switch>
    );
}

/** Events hosted by the member. */
function HostedEvents(props: { events: CalendarEntry[] }) {
    return (
        <Section title="hosted events">
            <Show
                when={props.events.length > 0}
                fallback={<p class="text-soft">no hosted events.</p>}
            >
                <DirectoryList>
                    <For each={props.events}>
                        {(event) => (
                            <DirectoryRow
                                href={event.href ?? "/events"}
                                meta={event.location}
                                summary={event.summary}
                                title={event.title}
                            />
                        )}
                    </For>
                </DirectoryList>
            </Show>
        </Section>
    );
}

/** Member profile sections. */
function ProfileSections(props: { handle: string; member: PublicMember | null | undefined }) {
    return (
        <div class="grid gap-8">
            {/* details */}
            <Section title="details">
                <DetailList>
                    <DetailRow label="handle" value={`@${props.handle}`} />
                    <DetailRow label="visibility" value={props.member ? "public" : "private"} />
                </DetailList>

                {/* interests */}
                <Show when={props.member && props.member.interests.length > 0}>
                    <div class="mt-4">
                        <Tags values={props.member?.interests ?? []} />
                    </div>
                </Show>
            </Section>

            {/* links */}
            <Show when={props.member && props.member.links.length > 0}>
                <Section title="links">
                    <ExternalLinks links={props.member?.links ?? []} />
                </Section>
            </Show>

            {/* bio */}
            <Show when={props.member?.bio}>
                <Section title="bio">
                    <p class="text-soft">{props.member?.bio}</p>
                </Section>
            </Show>
        </div>
    );
}
