import { EditLink } from "../../auth/edit";
import { ArrowDown, ArrowUpRight } from "lucide-solid";
import { useAccount } from "../../auth";
import { SponsorshipContact } from "../../sponsorships/contact";
import { createSignal, For, Show } from "solid-js";
import { Sponsors } from "../../sponsorships/sponsors";
import { getSponsors, getPersonalSponsors } from "../../sponsorships/queries";
import { Arrow } from "../../components/arrow";
import { StatisticsOverview } from "../../statistics/overview";
import { getStatistics, getAudience } from "../../statistics/queries";
import { CommunityAudience } from "../../statistics/audience";
import { tiers, personalTiers } from "../../../convex/sponsorships/plans";
import { Page, PageHeader } from "../page";
import { Seo } from "../seo";
import "../sponsor-route.css";

/** Start sponsor requests when navigation is preloaded, before rendering the page. */
export const route = {
    preload: () =>
        Promise.all([getSponsors(), getPersonalSponsors(), getStatistics(), getAudience()]),
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
    const [inquiry, setInquiry] = createSignal<string>();

    return (
        <>
            <Seo
                title="Sponsor"
                description="Support Zurich's tech community: talks, meetups and connections between people building things."
            />
            <Page class="sponsorship-route publication">
                {/* pitch with the primary action */}
                <PageHeader
                    title="Sponsor zurich.tech"
                    summary="Support Zurich's tech community directly."
                    actions={
                        <>
                            <a class="button button--primary" href="#sponsorship-plans">
                                View sponsorships <ArrowDown size={16} />
                            </a>
                            <button
                                type="button"
                                class="action-link"
                                onClick={() => setInquiry("")}
                            >
                                Get in touch <ArrowUpRight size={16} />
                            </button>
                        </>
                    }
                />

                {/* combine community scale and survey distributions */}
                <CommunityAudience compact>
                    <Show when={statistics()}>
                        {(current) => <StatisticsOverview statistics={current()} compact />}
                    </Show>
                </CommunityAudience>

                {/* keep each plan's price, benefits and inquiry together */}
                <section class="sponsorship-options" aria-labelledby="sponsorship-plans">
                    <header class="sponsorship-section-heading">
                        <h2 id="sponsorship-plans">Sponsorship</h2>
                        <p>Per year, invoiced annually</p>
                    </header>
                    <div class="sponsorship-funding">
                        <p>Sponsorship funds venues, food and the tools behind our events.</p>
                        <EditLink href="/admin?section=sponsors" label="Manage" />
                    </div>
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
                                        <button
                                            type="button"
                                            class="button"
                                            onClick={() => setInquiry(tier.name)}
                                        >
                                            Choose {tier.name}
                                            <Arrow />
                                        </button>
                                    </div>
                                </article>
                            )}
                        </For>
                    </div>
                </section>

                {/* current supporters */}
                <Sponsors isFullPage />

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
            </Page>
            <SponsorshipContact
                isOpen={inquiry() !== undefined}
                tier={inquiry()}
                name={account.user()?.name}
                onClose={() => setInquiry(undefined)}
            />
        </>
    );
}
