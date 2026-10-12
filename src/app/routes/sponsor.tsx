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
import { Card } from "../../components/card";
import { Seo } from "../seo";

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

/** One compared benefit and its value in each plan; absent benefits read as a dash. */
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
                description={reach.map(({ value, label }) => `${value} ${label}`).join(". ")}
            />
            <Page class="sponsor-page">
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
                <ul class="sponsor-reach">
                    <For each={reach}>
                        {(item) => (
                            <li>
                                <strong>{item.value}</strong>
                                <span class="sponsor-reach-label">{item.label}</span>
                            </li>
                        )}
                    </For>
                </ul>

                {/* plans compared side by side */}
                <Card title="Plans" class="sponsor-plans-card">
                    <div class="plan-table" role="table" aria-label="Sponsorship plans">
                        <div class="plan-row plan-row--head" role="row">
                            <span role="columnheader" class="plan-corner">
                                Per year, invoiced annually
                            </span>
                            <For each={plans}>
                                {(tier) => (
                                    <div
                                        role="columnheader"
                                        class="plan-head"
                                        classList={{ "is-featured": tier.id === "silver" }}
                                    >
                                        <h3>{tier.name}</h3>
                                        <p class="tier-price">
                                            <span>CHF</span>
                                            {tier.price.toLocaleString("de-CH")}
                                        </p>
                                        <p class="plan-intro">{tier.purpose}</p>
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
                                )}
                            </For>
                        </div>
                        <For each={benefits}>
                            {(benefit) => (
                                <div class="plan-row" role="row">
                                    <span role="rowheader" class="plan-benefit">
                                        {benefit.label}
                                    </span>
                                    <For each={plans}>
                                        {(tier) => (
                                            <span
                                                role="cell"
                                                class="plan-cell"
                                                classList={{
                                                    "is-featured": tier.id === "silver",
                                                    "is-empty": !benefit.value(tier),
                                                }}
                                            >
                                                {benefit.value(tier) ?? "—"}
                                            </span>
                                        )}
                                    </For>
                                </div>
                            )}
                        </For>
                    </div>
                </Card>

                {/* personal support as one strip */}
                <For each={personalTiers}>
                    {(tier) => (
                        <Card
                            title={`Or become a ${tier.name.toLowerCase()}`}
                            class="plan-personal"
                        >
                            <div class="plan-personal__body">
                                <p class="tier-price">
                                    <span>CHF</span>
                                    {tier.price}
                                    <span>/ year</span>
                                </p>
                                <p>
                                    {tier.recognition}, and a {tier.name.toLowerCase()} badge on
                                    your profile.
                                </p>
                                <button class="button" disabled>
                                    Coming soon
                                </button>
                            </div>
                        </Card>
                    )}
                </For>

                {/* current supporters */}
                <Sponsors isFullPage />
            </Page>
        </>
    );
}
