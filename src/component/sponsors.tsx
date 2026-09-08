import { getSponsors } from "../core/queries";
import { createAsync } from "@solidjs/router";
import { For, Show } from "solid-js";

import { tiers } from "../../shared/plans";
import { Patrons } from "./patrons";
import { Card } from "./card";

/** Display active sponsors by tier, with space for the next supporter. */
export function Sponsors() {
    const sponsors = createAsync(() => getSponsors());

    return (
        <Card class="sponsors" title="Sponsors">
            <For each={tiers}>
                {(tier, index) => (
                    <section class="sponsor-tier">
                        <h3>{tier.name}</h3>
                        <div class="sponsor-logos" style={{ "--sponsor-columns": index() + 1 }}>
                            <For each={sponsors()?.filter((sponsor) => sponsor.tier === tier.id)}>
                                {(sponsor) => (
                                    <a
                                        class="sponsor-logo"
                                        href={sponsor.website}
                                        target="_blank"
                                        rel="noreferrer"
                                        title={sponsor.name}
                                    >
                                        <Show
                                            when={sponsor.logoUrl}
                                            fallback={<span>{sponsor.name}</span>}
                                        >
                                            <img
                                                src={sponsor.logoUrl}
                                                alt={sponsor.name}
                                                loading="lazy"
                                            />
                                        </Show>
                                    </a>
                                )}
                            </For>
                            <Show
                                when={
                                    sponsors() &&
                                    !sponsors()!.some((sponsor) => sponsor.tier === tier.id)
                                }
                            >
                                <a
                                    class="sponsor-logo sponsor-vacancy"
                                    href={`/sponsor?tier=${tier.id}`}
                                    aria-label={`Become a ${tier.name.toLowerCase()}`}
                                >
                                    <span aria-hidden="true">+</span>
                                </a>
                            </Show>
                        </div>
                    </section>
                )}
            </For>
            <Patrons />
            <div class="sponsor-action">
                <a class="button" href="/sponsor">
                    Become a sponsor
                </a>
            </div>
        </Card>
    );
}
