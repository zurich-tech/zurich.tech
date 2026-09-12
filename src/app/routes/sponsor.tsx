import { useAccount } from "../../auth";
import { sponsorshipInquiry } from "../../sponsorships/inquiries";
import { site } from "../site";
import { For, Show } from "solid-js";
import { Sponsors } from "../../sponsorships/sponsors";

import { Arrow } from "../../components/arrow";
import { tiers, personalTiers } from "../../sponsorships/plans";
import { Page } from "../page";
import { Card } from "../../components/card";
import { Seo } from "../seo";

/** Stated reach shown with the sponsorship options. */
const reach = [
    `${site.members.toLocaleString("en-GB")}+ members`,
    `${site.attendees.toLocaleString("en-GB")}+ attendees at most events`,
    `More than ${site.eventsPerYear} events a year`,
];

/** Present annual support and open sponsorship inquiries. */
export default function Route() {
    const account = useAccount();

    return (
        <>
            <Seo title="Sponsor" description={reach.join(" ")} />
            <Page>
                <Card title="Support zurich.tech" heading="h1" class="sponsor-intro">
                    <p class="sponsor-lead">
                        Meet the people building tech in Zürich. Reach developers, researchers,
                        founders and future colleagues through our events and newsletter.
                    </p>
                    <div class="sponsor-overview">
                        <section>
                            <h2>What you get</h2>
                            <ul class="plan-benefits">
                                <li>
                                    <Arrow />
                                    <strong>Visibility throughout the year</strong>
                                    <span>
                                        Your company on our website, in our newsletter and at our
                                        events.
                                    </span>
                                </li>
                                <li>
                                    <Arrow />
                                    <strong>Reach people you want to hire</strong>
                                    <span>
                                        Job listings shared with a local community interested in
                                        tech.
                                    </span>
                                </li>
                                <li>
                                    <Arrow />
                                    <strong>Meet the community</strong>
                                    <span>
                                        Build relationships at talks, dinners and hackathons. Gold
                                        also includes a jointly organised event.
                                    </span>
                                </li>
                            </ul>
                        </section>
                        <section class="sponsor-funding">
                            <h2>What you fund</h2>
                            <p class="sponsor-allocation">
                                <strong>100%</strong>
                                <span>goes to operating costs</span>
                            </p>
                            <p>We’re a nonprofit run entirely by volunteers.</p>
                            <p>
                                Your support pays for venues, food, equipment and the services that
                                keep the community running.
                            </p>
                            <p>
                                <strong>The more support we have, the more we can do.</strong>
                            </p>
                        </section>
                    </div>
                    <ul class="sponsor-reach">
                        <For each={reach}>{(sentence) => <li>{sentence}</li>}</For>
                    </ul>
                </Card>
                <div class="sponsor-plans">
                    <For each={[...tiers].reverse()}>
                        {(tier) => (
                            <Card
                                title={tier.name}
                                class={`offer-card sponsor-plan${tier.id === "silver" ? " sponsor-plan--featured" : ""}`}
                            >
                                <p class="tier-price">
                                    <span>CHF</span> {tier.price.toLocaleString("de-CH")}
                                    <span>/ year</span>
                                </p>
                                <PlanIntro
                                    purpose={tier.purpose}
                                    contribution={tier.contribution}
                                />
                                <a
                                    class="button button--primary"
                                    href={sponsorshipInquiry(tier.name, account.user()?.name)}
                                >
                                    Choose {tier.name}
                                </a>
                                <ul class="plan-benefits">
                                    <li>
                                        <Arrow />
                                        <strong>{tier.jobs} included jobs</strong>
                                        <span>Replace roles as you hire.</span>
                                    </li>
                                    <li>
                                        <Arrow />
                                        <strong>{tier.description}</strong>
                                        <span>Linked to your website.</span>
                                    </li>
                                    <li>
                                        <Arrow />
                                        <strong>On our event banner</strong>
                                        <span>{tier.banner}</span>
                                    </li>
                                    <li>
                                        <Arrow />
                                        <strong>{tier.map}</strong>
                                        <span>
                                            Your local office links to your organisation page.
                                        </span>
                                    </li>
                                    <Show when={tier.newsletter}>
                                        <li>
                                            <Arrow />
                                            <strong>Every newsletter</strong>
                                            <span>{tier.newsletter}</span>
                                        </li>
                                    </Show>
                                    <Show when={tier.slides}>
                                        <li>
                                            <Arrow />
                                            <strong>Represented at every event</strong>
                                            <span>{tier.slides}</span>
                                        </li>
                                    </Show>
                                    <Show when={tier.news}>
                                        <li>
                                            <Arrow />
                                            <strong>{tier.news?.title}</strong>
                                            <span>{tier.news?.description}</span>
                                        </li>
                                    </Show>
                                    <Show when={tier.events}>
                                        <li>
                                            <Arrow />
                                            <strong>Partner events</strong>
                                            <span>{tier.events}</span>
                                        </li>
                                    </Show>
                                </ul>
                            </Card>
                        )}
                    </For>
                </div>
                <div class="sponsor-plans sponsor-plans--personal">
                    <For each={personalTiers}>
                        {(tier) => (
                            <Card
                                title={tier.name}
                                class={`offer-card sponsor-plan${tier.id === "patron" ? " sponsor-plan--featured" : ""}`}
                            >
                                <p class="tier-price">
                                    <span>CHF</span> {tier.price}
                                    <span>/ year</span>
                                </p>
                                <PlanIntro
                                    purpose={tier.purpose}
                                    contribution={tier.contribution}
                                />
                                <button class="button button--primary" disabled>
                                    Become a {tier.name.toLowerCase()}
                                </button>
                                <ul class="plan-benefits">
                                    <li>
                                        <Arrow />
                                        <strong>{tier.recognition}</strong>
                                        <span>Linked to your chosen website.</span>
                                    </li>
                                    <li>
                                        <Arrow />
                                        <strong>{tier.name} badge on your profile</strong>
                                        <span>Your title appears on hover.</span>
                                    </li>
                                </ul>
                            </Card>
                        )}
                    </For>
                </div>
                <Sponsors isFullPage />
                <div class="sponsor-details">
                    <Card title="Become a sponsor" id="request">
                        <a
                            class="button button--primary"
                            href={sponsorshipInquiry(undefined, account.user()?.name)}
                        >
                            Sponsorship inquiry
                        </a>
                    </Card>
                </div>
            </Page>
        </>
    );
}

/** Pair each support option with its purpose and a muted cost byline. */
function PlanIntro(props: {
    /** Main reason to support. */ purpose: string;
    /** Costs supported by the contribution. */ contribution: string;
}) {
    return (
        <div class="plan-intro">
            <p>{props.purpose}</p>
            <p class="plan-byline">{props.contribution}</p>
        </div>
    );
}
