import { useAccount } from "../../auth";
import { sponsorshipInquiry } from "../../sponsorships/inquiries";
import { site } from "../site";
import { For, Show } from "solid-js";
import { Sponsors } from "../../sponsorships/sponsors";
import { Patrons } from "../../sponsorships/patrons";

import { Arrow } from "../../components/arrow";
import { tiers, patron } from "../../sponsorships/plans";
import { Page } from "../page";
import { Card } from "../../components/card";
import { Seo } from "../seo";

/** Stated reach shown with the sponsorship options. */
const reach = [
    `${site.subscribers.toLocaleString("en-GB")}+ mailing-list subscribers.`,
    `${site.attendees.toLocaleString("en-GB")}+ attendees at most of our events.`,
    `>${site.eventsPerYear} events/year.`,
];

/** Present annual support and open sponsorship inquiries. */
export default function Route() {
    const account = useAccount();

    return (
        <>
            <Seo title="Sponsor" description={reach.join(" ")} />
            <Page>
                <Card title="Support zurich.tech" heading="h1">
                    <ul class="plan-benefits">
                        <For each={reach}>
                            {(sentence) => (
                                <li>
                                    <Arrow />
                                    <strong>{sentence}</strong>
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
                                class={`offer-card sponsor-plan sponsor-plan--${tier.id}`}
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
                                    Become a {tier.name.toLowerCase()}
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
                                            <strong>At our events</strong>
                                            <span>{tier.slides}</span>
                                        </li>
                                    </Show>
                                    <Show when={tier.news}>
                                        <li>
                                            <Arrow />
                                            <strong>Partner news</strong>
                                            <span>{tier.news}</span>
                                        </li>
                                    </Show>
                                </ul>
                            </Card>
                        )}
                    </For>
                </div>
                <Card
                    title="Patron"
                    class="patron-plan"
                    toolbar={
                        <button class="button button--primary" disabled>
                            Become a patron
                        </button>
                    }
                >
                    <div class="patron-offer">
                        <p class="tier-price">
                            <span>CHF</span> {patron.price}
                            <span>/ year</span>
                        </p>
                        <PlanIntro purpose={patron.purpose} contribution={patron.contribution} />
                        <ul class="plan-benefits">
                            <li>
                                <Arrow />
                                <strong>Linked avatar on the patron wall</strong>
                                <span>Patron badge on your profile</span>
                            </li>
                        </ul>
                    </div>
                </Card>
                <Sponsors isFullPage />
                <Patrons isFullPage />
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
