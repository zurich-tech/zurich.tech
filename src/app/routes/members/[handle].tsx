import { Arrow } from "../../../components/arrow";
import { Affiliations } from "../../../members/affiliations";
import { personalTiers } from "../../../sponsorships/plans";
import { getMember } from "../../../members/queries";
import { type CalendarEntry } from "../../../events/queries";
import { Avatar } from "../../../components/avatar";
import { Card } from "../../../components/card";
import { useParams } from "@solidjs/router";
import { Match, Show, Switch } from "solid-js";

import { EventList } from "../../../events/list";
import { getDirectory } from "../../../organisations/queries";
import { SocialLinks } from "../../../components/social";
import { NotFound } from "../../notfound";
import { EditLink } from "../../../auth/edit";
import { Page, ItemHeader } from "../../page";
import { Seo } from "../../seo";

import { routeParam } from "../../params";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: ({ params }: { params: Record<string, string> }) =>
        Promise.all([getMember(params.handle), getDirectory()]),
};

/** Member profile. */
export default function Route() {
    // route params
    const params = useParams();
    const handle = () => routeParam("handle", params.handle);

    // member
    const member = getMember.use(() => [handle()]);
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
                        <a class="eyebrow" href="/members">
                            <Arrow direction="left" /> Members
                        </a>
                        <ItemHeader
                            title={title()}
                            actions={<EditLink memberId={member()!.id} href="/settings" />}
                            summary={
                                <div class="member-identity">
                                    <Avatar
                                        name={title()}
                                        image={member()?.avatarUrl}
                                        imageDark={member()?.avatarDarkUrl}
                                    />
                                    <Affiliations values={member()?.affiliations} />
                                </div>
                            }
                        >
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
                            <SocialLinks
                                name={title()}
                                labelled
                                profiles={(member()?.links ?? []).map((link) => link.href)}
                            />
                        </ItemHeader>
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
    const directory = getDirectory.use(() => []);

    return (
        <Card title="Events" class="programme">
            <EventList
                events={[...props.events].sort((left, right) => right.startsAt - left.startsAt)}
                series={directory()?.series ?? []}
                now={Date.now()}
                showToday
            />
        </Card>
    );
}
