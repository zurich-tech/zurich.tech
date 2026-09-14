import { Affiliations } from "../../../members/affiliations";
import { personalTiers } from "../../../sponsorships/plans";
import { getMember } from "../../../members/queries";
import { type CalendarEntry } from "../../../events/queries";
import { Avatar } from "../../../components/avatar";
import { Card } from "../../../components/card";
import { createAsync, useParams } from "@solidjs/router";
import { For, Match, Show, Switch } from "solid-js";

import { DirectoryList, DirectoryRow } from "../../../components/list";
import { SocialLinks } from "../../../components/social";
import { NotFound } from "../../notfound";
import { Page } from "../../page";
import { Seo } from "../../seo";

import { routeParam } from "../../params";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: ({ params }: { params: Record<string, string> }) => getMember(params.handle),
};

/** Member profile. */
export default function Route() {
    // route params
    const params = useParams();
    const handle = () => routeParam("handle", params.handle);

    // member
    const member = createAsync(() => getMember(handle()), { deferStream: true });
    const title = () => member()?.name ?? `@${handle()}`;

    return (
        <Switch>
            {/* missing */}
            <Match when={member() === null}>
                <NotFound />
            </Match>

            {/* member */}
            <Match when={member() !== undefined}>
                <>
                    <Seo title={title()} description={`@${handle()} on zurich.tech.`} />
                    <Page>
                        <header class="page-header member-header">
                            <Avatar
                                name={title()}
                                image={member()?.avatarUrl}
                                imageDark={member()?.avatarDarkUrl}
                            />
                            <div class="page-header__copy">
                                <h1>{title()}</h1>
                                <Affiliations values={member()?.affiliations} />
                                <Show when={member()?.isSpeaker}>
                                    <span class="tag">Speaker</span>
                                </Show>
                                <Show when={member()?.sponsorTier}>
                                    <span class="tag">
                                        {
                                            personalTiers.find(
                                                (tier) => tier.id === member()?.sponsorTier,
                                            )?.name
                                        }
                                    </span>
                                </Show>
                            </div>
                            <SocialLinks
                                name={title()}
                                labelled
                                profiles={(member()?.links ?? []).map((link) => link.href)}
                            />
                        </header>
                        <Show when={member()?.bio}>
                            <Card title="About">
                                <Show when={member()?.bio}>
                                    <p class="organisation-description">{member()?.bio}</p>
                                </Show>
                            </Card>
                        </Show>
                        <Show when={member()?.hostedEvents.length}>
                            <HostedEvents events={member()?.hostedEvents ?? []} />
                        </Show>
                    </Page>
                </>
            </Match>
        </Switch>
    );
}

/** Events hosted by the member. */
function HostedEvents(props: { events: CalendarEntry[] }) {
    return (
        <Card title="Events">
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
