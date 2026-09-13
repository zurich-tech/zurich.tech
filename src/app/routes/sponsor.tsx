import { EditLink } from "../../auth/edit";
import { useAccount } from "../../auth";
import { sponsorshipInquiry } from "../../sponsorships/inquiries";
import { site } from "../site";
import { For, Show } from "solid-js";
import { Sponsors } from "../../sponsorships/sponsors";
import { getSponsors, getPersonalSponsors } from "../../sponsorships/queries";

import { Arrow } from "../../components/arrow";
import { tiers, personalTiers } from "../../sponsorships/plans";
import { Page } from "../page";
import { Card } from "../../components/card";
import { Seo } from "../seo";
import "../../statistics/style.css";

/** Start sponsor requests when navigation is preloaded, before rendering the page. */
export const route = {
    preload: () => Promise.all([getSponsors(), getPersonalSponsors()]),
};

/** Stated reach shown with the sponsorship options. */
const reach = [
    { value: `${site.members.toLocaleString("en-GB")}+`, label: "members" },
    { value: `${site.attendees.toLocaleString("en-GB")}+`, label: "attendees at most events" },
    { value: `${site.eventsPerYear}+`, label: "events a year" },
];

/** Present annual support and open sponsorship inquiries. */
export default function Route() {
    const account = useAccount();

    return (
        <>
            <Seo
                title="Sponsor"
                description={reach.map(({ value, label }) => `${value} ${label}`).join(". ")}
            />
            <Page>
                <Card
                    toolbar={<EditLink href="/admin?section=sponsors" label="Manage" />}
                    title="Support zurich.tech"
                    heading="h1"
                    class="sponsor-intro card--sections"
                >
                    <div class="sponsor-overview card-section">
                        <section>
                            <h2>What you get</h2>
                            <ul class="plan-benefits">
                                <li>
                                    <Arrow />
                                    <strong>Share your work</strong>
                                    <span>
                                        Your company on our website, in our newsletter and at our
                                        events.
                                    </span>
                                </li>
                                <li>
                                    <Arrow />
                                    <strong>Find colleagues</strong>
                                    <span>Share your open roles with our members.</span>
                                </li>
                                <li>
                                    <Arrow />
                                    <strong>Meet people</strong>
                                    <span>Talk to people at our events.</span>
                                </li>
                            </ul>
                        </section>
                        <section class="sponsor-funding">
                            <h2>What you fund</h2>
                            <ul class="plan-benefits">
                                <li>
                                    <Arrow />
                                    <strong>No salaries</strong>
                                    <span>All sponsorship money goes to operating costs.</span>
                                </li>
                                <li>
                                    <Arrow />
                                    <strong>Event costs</strong>
                                    <span>Venues, food and equipment.</span>
                                </li>
                                <li>
                                    <Arrow />
                                    <strong>Community services</strong>
                                    <span>
                                        The website, email and tools we use to organise events.
                                    </span>
                                </li>
                            </ul>
                        </section>
                    </div>
                    <ul class="sponsor-reach card-section">
                        <For each={reach}>
                            {(item) => (
                                <li class="stats-metric is-highlighted">
                                    <div class="stats-value">
                                        <strong>{item.value}</strong>
                                    </div>
                                    <span class="sponsor-reach-label">{item.label}</span>
                                </li>
                            )}
                        </For>
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
                                <p class="plan-intro">{tier.purpose}</p>
                                <a
                                    class="button button--primary"
                                    href={sponsorshipInquiry(tier.name, account.user()?.name)}
                                >
                                    Choose {tier.name}
                                </a>
                                <ul class="plan-benefits">
                                    <li>
                                        <Arrow />
                                        <strong>
                                            {tier.jobs === null
                                                ? "Unlimited active jobs"
                                                : `${tier.jobs} active jobs`}
                                        </strong>
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
                                        <span>Your office, linked to your organisation page.</span>
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
                                            <strong>At every event</strong>
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
                            <Card title={tier.name} class="offer-card sponsor-plan">
                                <p class="tier-price">
                                    <span>CHF</span> {tier.price}
                                    <span>/ year</span>
                                </p>
                                <p class="plan-intro">{tier.purpose}</p>
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
