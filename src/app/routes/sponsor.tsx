import { EditLink } from "../../auth/edit";
import { useAccount } from "../../auth";
import { sponsorshipInquiry } from "../../sponsorships/inquiries";
import { For, Show } from "solid-js";
import { Sponsors } from "../../sponsorships/sponsors";
import { getSponsors, getPersonalSponsors } from "../../sponsorships/queries";
import { Arrow } from "../../components/arrow";
import { StatisticsOverview } from "../../statistics/overview";
import { getStatistics } from "../../statistics/queries";
import { tiers, personalTiers } from "../../../convex/sponsorships/plans";
import { Page, PageHeader } from "../page";
import { Seo } from "../seo";
import "../sponsor-route.css";

/** Start sponsor requests when navigation is preloaded, before rendering the page. */
export const route = {
    preload: () => Promise.all([getSponsors(), getPersonalSponsors(), getStatistics()]),
};

/** Plans from smallest to largest, as read left to right. */
const plans = [...tiers].reverse();

/** One benefit and its value in each applicable plan. */
const benefits: { label: string; value: (tier: (typeof tiers)[number]) => string | undefined }[] = [
    {
        label: "Job listings",
        value: (tier) => (tier.jobs === null ? "Unlimited included" : `${tier.jobs} included`),
    },
    { label: "Website", value: (tier) => tier.description },
    { label: "Event banner", value: (tier) => tier.banner },
    { label: "Community map", value: (tier) => tier.map },
    { label: "Newsletter", value: (tier) => tier.newsletter },
    { label: "News sharing", value: (tier) => tier.news?.description },
    { label: "Partner events", value: (tier) => tier.events },
];

/** Present annual support and open sponsorship inquiries. */
export default function Route() {
    const account = useAccount();
    const statistics = getStatistics.use(() => []);

    return (
        <>
            <Seo
                title="Sponsor"
                description="Help fund tech events in Zurich. Sponsorships pay for venues, food and event costs."
            />
            <Page class="sponsorship-route publication">
                {/* pitch with the primary action */}
                <PageHeader
                    title="Sponsor zurich.tech"
                    summary="Sponsorships pay for venues, food and the tools we use to run events. Nobody gets a salary; every franc goes into the community."
                    actions={
                        <>
                            <EditLink href="/admin?section=sponsors" label="Manage" />
                            <a
                                class="button button--primary"
                                href={sponsorshipInquiry(undefined, account.user()?.name)}
                            >
                                Get in touch <Arrow />
                            </a>
                        </>
                    }
                />

                {/* show the same live totals and growth as the statistics page */}
                <Show when={statistics()}>
                    {(current) => <StatisticsOverview statistics={current()} />}
                </Show>

                {/* keep each plan's price, benefits and inquiry together */}
                <section class="sponsorship-options" aria-labelledby="sponsorship-plans">
                    <header class="sponsorship-section-heading">
                        <h2 id="sponsorship-plans">Company sponsorship</h2>
                        <p>Per year, invoiced annually</p>
                    </header>
                    <div class="sponsorship-plans">
                        <For each={plans}>
                            {(tier) => (
                                <article
                                    class="sponsorship-plan"
                                    data-tier={tier.id}
                                    aria-labelledby={`sponsorship-${tier.id}`}
                                >
                                    <header class="sponsorship-plan-heading">
                                        <h3 id={`sponsorship-${tier.id}`}>{tier.name}</h3>
                                        <p class="sponsorship-price">
                                            <span>CHF</span>
                                            <strong>{tier.price.toLocaleString("de-CH")}</strong>
                                            <span>/ year</span>
                                        </p>
                                        <p class="sponsorship-purpose">{tier.purpose}</p>
                                    </header>
                                    <dl class="sponsorship-benefits">
                                        <For each={benefits}>
                                            {(benefit) => (
                                                <Show when={benefit.value(tier)}>
                                                    {(value) => (
                                                        <div>
                                                            <dt>{benefit.label}</dt>
                                                            <dd>{value()}</dd>
                                                        </div>
                                                    )}
                                                </Show>
                                            )}
                                        </For>
                                    </dl>
                                    <div class="sponsorship-plan-action">
                                        <a
                                            class="button"
                                            href={sponsorshipInquiry(
                                                tier.name,
                                                account.user()?.name,
                                            )}
                                        >
                                            Choose {tier.name}
                                            <Arrow />
                                        </a>
                                    </div>
                                </article>
                            )}
                        </For>
                    </div>
                </section>

                {/* personal support as one strip */}
                <For each={personalTiers}>
                    {(tier) => (
                        <section
                            class="sponsorship-personal"
                            aria-labelledby={`personal-${tier.id}`}
                        >
                            <div>
                                <h2 id={`personal-${tier.id}`}>
                                    Become a {tier.name.toLowerCase()}
                                </h2>
                                <p>
                                    {tier.recognition}, and a {tier.name.toLowerCase()} badge on
                                    your profile.
                                </p>
                            </div>
                            <p class="sponsorship-price">
                                <span>CHF</span>
                                <strong>{tier.price}</strong>
                                <span>/ year</span>
                            </p>
                            <button class="button" disabled>
                                Coming soon
                            </button>
                        </section>
                    )}
                </For>

                {/* current supporters */}
                <Sponsors isFullPage />
            </Page>
        </>
    );
}
