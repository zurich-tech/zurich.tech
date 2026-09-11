import { site } from "../site";
import { For, Show, createSignal } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CheckoutButton } from "../../billing/payments";
import { Sponsors } from "../../sponsorships/sponsors";

import { Arrow } from "../../components/arrow";
import { tiers, patron } from "../../sponsorships/plans";
import { useEmployerWorkspace } from "../workspace";
import { CompanySelect } from "../../organisations/company";
import { memberClient } from "../../auth/convex";
import { Page } from "../page";
import { Card } from "../../components/card";
import { Seo } from "../seo";
import { FormMessage } from "../../components/form";
import { errorMessage } from "../../components/errors";

/** Stated reach shown with the sponsorship options. */
const reach = [
    `${site.subscribers.toLocaleString("en-GB")}+ mailing-list subscribers.`,
    `${site.attendees.toLocaleString("en-GB")}+ attendees at most of our events.`,
    `>${site.eventsPerYear} events/year.`,
];

/** Present annual support and open hosted checkout for company sponsorship. */
export default function Route() {
    const { account, workspace } = useEmployerWorkspace();
    const [params] = useSearchParams();
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    /** Save the sponsorship request and continue to hosted checkout. */
    async function submit(event: SubmitEvent) {
        // read the company and chosen sponsorship tier
        event.preventDefault();
        const fields = new FormData(event.currentTarget as HTMLFormElement);
        setIsPending(true);
        setError(undefined);
        try {
            const client = await memberClient();
            const id = await client.mutation(api.sponsorships.organisations.request, {
                organisationId: String(fields.get("organisationId")) as Id<"organisations">,
                tier: String(fields.get("tier")) as "principal" | "partner" | "supporter",
                billingEmail: String(fields.get("billingEmail")),
            });
            const url = await client.action(api.billing.stripe.start, {
                purchase: { kind: "sponsorship", id },
            });
            window.location.assign(url);
        } catch (caught) {
            setError(errorMessage(caught, "Could not request sponsorship."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <Seo title="Sponsor zurich.tech" description={reach.join(" ")} />
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
                                <a class="button button--primary" href={`?tier=${tier.id}#request`}>
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
                        <CheckoutButton purchase={{ kind: "patron" }} label="Become a patron" />
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
                                <strong>Linked avatar on the sponsor wall</strong>
                                <span>Patron badge on your profile</span>
                            </li>
                        </ul>
                    </div>
                </Card>
                <Sponsors isFullPage />
                <div class="sponsor-details">
                    <Card title="Become a sponsor" id="request">
                        <Show
                            when={account.user()}
                            fallback={
                                <a
                                    class="button button--primary"
                                    href={`/sign-in?next=${encodeURIComponent(`/sponsor?tier=${params.tier ?? "partner"}#request`)}`}
                                >
                                    Continue with GitHub or X
                                </a>
                            }
                        >
                            <Show when={workspace.error}>
                                <p class="form-error">
                                    {errorMessage(
                                        workspace.error,
                                        "Could not load your companies.",
                                    )}
                                </p>
                            </Show>
                            <Show when={workspace()}>
                                {(current) => (
                                    <Show
                                        when={current().organisations.length}
                                        fallback={
                                            <p>
                                                <a class="text-link" href="/manage#companies">
                                                    Add your company
                                                </a>{" "}
                                                to request sponsorship.
                                            </p>
                                        }
                                    >
                                        <form class="editor" onSubmit={submit}>
                                            <CompanySelect companies={current().organisations} />
                                            <label>
                                                Level
                                                <select
                                                    name="tier"
                                                    value={
                                                        tiers.some(
                                                            (tier) => tier.id === params.tier,
                                                        )
                                                            ? String(params.tier)
                                                            : "partner"
                                                    }
                                                >
                                                    <For each={tiers}>
                                                        {(tier) => (
                                                            <option value={tier.id}>
                                                                {tier.name} · CHF {tier.price}
                                                                /year
                                                            </option>
                                                        )}
                                                    </For>
                                                </select>
                                            </label>
                                            <label>
                                                Invoice email
                                                <input
                                                    name="billingEmail"
                                                    type="email"
                                                    required
                                                    value={account.user()?.email ?? ""}
                                                />
                                            </label>

                                            <button
                                                class="button button--primary"
                                                disabled={isPending()}
                                            >
                                                {isPending() ? "Sending…" : "Continue to payment"}
                                            </button>
                                        </form>
                                        <FormMessage error={error()} />
                                        <a class="text-link" href="/manage#sponsors">
                                            Manage sponsorships
                                        </a>
                                    </Show>
                                )}
                            </Show>
                        </Show>
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
