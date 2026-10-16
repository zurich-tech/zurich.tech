import { EditLink } from "../../auth/edit";
import { useAccount } from "../../auth";
import { sponsorshipInquiry } from "../../sponsorships/inquiries";
import { site } from "../site";
import { For } from "solid-js";
import { Sponsors } from "../../sponsorships/sponsors";
import { getSponsors, getPersonalSponsors } from "../../sponsorships/queries";
import { Arrow } from "../../components/arrow";
import { tiers, personalTiers } from "../../sponsorships/plans";
import { Page, PageHeader } from "../page";
import { Seo } from "../seo";
import "../sponsor-route.css";

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

/** Plans from smallest to largest, as read left to right. */
const plans = [...tiers].reverse();

/** One compared benefit and its value in each plan; absent benefits are explicitly labelled. */
const benefits: { label: string; value: (tier: (typeof tiers)[number]) => string | undefined }[] = [
    {
        label: "Active job listings",
        value: (tier) => (tier.jobs === null ? "Unlimited" : String(tier.jobs)),
    },
    { label: "Logo on our website", value: (tier) => tier.description },
    { label: "Event banner", value: (tier) => tier.banner },
    { label: "Community map", value: (tier) => tier.map },
    { label: "Every newsletter", value: (tier) => tier.newsletter },
    { label: "News sharing", value: (tier) => tier.news?.description },
    { label: "Partner events", value: (tier) => tier.events },
];

/** Present annual support and open sponsorship inquiries. */
export default function Route() {
    const account = useAccount();

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

                {/* reach in large numerals */}
                <ul class="sponsorship-reach" aria-label="Our community">
                    <For each={reach}>
                        {(item) => (
                            <li>
                                <strong>{item.value}</strong>
                                <span>{item.label}</span>
                            </li>
                        )}
                    </For>
                </ul>

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
                                    classList={{ "sponsorship-plan--silver": tier.id === "silver" }}
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
                                                <div>
                                                    <dt>{benefit.label}</dt>
                                                    <dd
                                                        classList={{
                                                            "is-unavailable": !benefit.value(tier),
                                                        }}
                                                    >
                                                        {benefit.value(tier) ?? "Not included"}
                                                    </dd>
                                                </div>
                                            )}
                                        </For>
                                    </dl>
                                    <div class="sponsorship-plan-action">
                                        <a
                                            class="button"
                                            classList={{ "button--primary": tier.id === "silver" }}
                                            href={sponsorshipInquiry(
                                                tier.name,
                                                account.user()?.name,
                                            )}
                                        >
                                            Choose {tier.name}
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
