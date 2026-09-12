import { createAsync } from "@solidjs/router";
import { getTeam } from "../../members/queries";
import { For } from "solid-js";
import { Card } from "../../components/card";
import { Page } from "../page";
import { Seo } from "../seo";
import { Image } from "../../components/image";
import { SocialLinks } from "../../components/social";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => getTeam(),
};

/** Introduce the people behind zurich.tech. */
export default function Route() {
    const team = createAsync(() => getTeam());
    return (
        <>
            <Seo
                title="About"
                description="A registered nonprofit bringing people together around tech in and around Zürich."
            />
            <Page>
                <Card title="About" heading="h1" class="team">
                    <div class="team-intro">
                        <p>
                            zurich.tech is a registered nonprofit organising talks, events, dinners,
                            hackathons and other fun and interesting things around tech in and
                            around Zürich.
                        </p>
                    </div>
                    <ul class="team-grid">
                        <For each={team()}>
                            {(member) => (
                                <li class="team-person">
                                    <Image
                                        class="team-portrait"
                                        src={member.image}
                                        darkSrc={member.imageDark}
                                        alt={member.name}
                                        width={320}
                                        height={320}
                                        loading="lazy"
                                    />
                                    <h2>{member.name}</h2>
                                    <p class="team-role">{member.role}</p>
                                    <p class="team-profession">{member.profession}</p>
                                    <SocialLinks name={member.name} profiles={member.links} />
                                </li>
                            )}
                        </For>
                    </ul>
                </Card>
            </Page>
        </>
    );
}
