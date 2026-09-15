import { Affiliations } from "../../members/affiliations";
import { Sponsors } from "../../sponsorships/sponsors";
import { getSponsors, getPersonalSponsors } from "../../sponsorships/queries";
import { EditLink } from "../../auth/edit";
import { getTeam } from "../../members/queries";
import { For } from "solid-js";
import { Card } from "../../components/card";
import { Page } from "../page";
import { Seo } from "../seo";
import { Image } from "../../components/image";
import { SocialLinks } from "../../components/social";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => Promise.all([getTeam(), getSponsors(), getPersonalSponsors()]),
};

/** Introduce the people behind zurich.tech. */
export default function Route() {
    const team = getTeam.use(() => []);
    return (
        <>
            <Seo
                title="About"
                description="A registered nonprofit bringing people together around tech in and around Zurich."
            />
            <Page>
                <Card
                    title="Team"
                    heading="h1"
                    toolbar={<EditLink href="/admin?section=people" label="Manage" />}
                    class="team card--sections"
                >
                    <ul class="team-grid card-section">
                        <For each={team()}>
                            {(member) => (
                                <li class="team-person">
                                    <a class="team-profile" href={member.href}>
                                        <Image
                                            class="team-portrait"
                                            src={member.image}
                                            darkSrc={member.imageDark}
                                            alt=""
                                            width={320}
                                            height={320}
                                            loading="lazy"
                                        />
                                        <h2>{member.name}</h2>
                                    </a>
                                    <p class="team-role">{member.role}</p>
                                    <Affiliations values={member.affiliations} />
                                    <SocialLinks name={member.name} profiles={member.links} />
                                </li>
                            )}
                        </For>
                    </ul>
                </Card>
                <Sponsors isFullPage />
            </Page>
        </>
    );
}
