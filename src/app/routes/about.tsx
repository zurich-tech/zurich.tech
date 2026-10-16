import { Affiliations } from "../../members/affiliations";
import { Sponsors } from "../../sponsorships/sponsors";
import { getSponsors, getPersonalSponsors } from "../../sponsorships/queries";
import { EditLink } from "../../auth/edit";
import { getTeam } from "../../members/queries";
import { For, Show } from "solid-js";
import { Card } from "../../components/card";
import { Page, PageHeader } from "../page";
import "../about.css";
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
                description="Meet the volunteers behind zurich.tech and the sponsors who help fund our events."
            />
            <Page class="publication">
                <PageHeader title="About" />
                <Card
                    title="Team"
                    toolbar={<EditLink href="/admin?section=people" label="Manage" />}
                    class="team card--sections"
                >
                    <For each={["active", "former"] as const}>
                        {(status) => (
                            <Show when={(team() ?? []).some((member) => member.status === status)}>
                                <section
                                    class="card-section"
                                    aria-label={status === "former" ? "Emeritus" : "Current team"}
                                >
                                    <Show when={status === "former"}>
                                        <h2 class="team-section-title">Emeritus</h2>
                                    </Show>
                                    <ul class="team-grid">
                                        <For
                                            each={(team() ?? []).filter(
                                                (member) => member.status === status,
                                            )}
                                        >
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
                                                    <Show when={member.status === "active"}>
                                                        <p class="team-role">{member.role}</p>
                                                    </Show>
                                                    <Affiliations values={member.affiliations} />
                                                    <SocialLinks
                                                        name={member.name}
                                                        profiles={member.links}
                                                    />
                                                </li>
                                            )}
                                        </For>
                                    </ul>
                                </section>
                            </Show>
                        )}
                    </For>
                </Card>
                <Sponsors isFullPage />
            </Page>
        </>
    );
}
