import { getMember, type PublicMember, type CalendarEntry } from "../../core/queries";
import { Card } from "../../component/card";
import { createAsync, useParams } from "@solidjs/router";
import { For, Match, Show, Switch } from "solid-js";

import { DirectoryList, DirectoryRow } from "../../component/list";
import { ExternalLinks, Tags } from "../../component/meta";
import { NotFound } from "../../component/notfound";
import { DetailList, DetailRow, Page, PageHeader } from "../../component/page";
import { Seo } from "../../component/seo";

import { routeParam } from "../../core/route";

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
                        <div class="event-layout">
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
        <Card title="Hosted events">
            <Show
                when={props.events.length > 0}
                fallback={<p class="text-soft">No hosted events.</p>}
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
        </Card>
    );
}

/** Member profile sections. */
function ProfileSections(props: { handle: string; member: PublicMember | null | undefined }) {
    return (
        <div class="event-aside">
            {/* details */}
            <Card title="Details">
                <Show when={props.member?.isPatron}>
                    <span class="tag">Patron</span>
                </Show>
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
            </Card>

            {/* links */}
            <Show when={props.member && props.member.links.length > 0}>
                <Card title="Links">
                    <ExternalLinks links={props.member?.links ?? []} />
                </Card>
            </Show>

            {/* bio */}
            <Show when={props.member?.bio}>
                <Card title="Bio">
                    <p class="text-soft">{props.member?.bio}</p>
                </Card>
            </Show>
        </div>
    );
}
