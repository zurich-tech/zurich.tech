import { PersonalSponsors } from "./members";
import { Image } from "../components/image";
import { getSponsors } from "./queries";
import { createAsync } from "@solidjs/router";
import { For, Show } from "solid-js";

import { tiers } from "./plans";
import { SocialLinks } from "../components/social";
import { Card } from "../components/card";

/** Display active sponsors by tier, with space for the next supporter. */
export function Sponsors(props: {
    /** Show existing supporters across the sponsor page without recruitment links. */
    isFullPage?: boolean;
}) {
    const sponsors = createAsync(() => getSponsors());

    return (
        <Card
            class={props.isFullPage ? "sponsors sponsors--full" : "sponsors"}
            id="sponsors"
            title="Sponsors"
            titleHref={props.isFullPage ? undefined : "/sponsor"}
        >
            <For
                each={tiers.filter(
                    (tier) =>
                        !props.isFullPage ||
                        sponsors()?.some((sponsor) => sponsor.tier === tier.id),
                )}
            >
                {(tier, index) => (
                    <section class="sponsor-tier">
                        <h3>{tier.name}</h3>
                        <div class="sponsor-logos" style={{ "--sponsor-columns": index() + 1 }}>
                            <For each={sponsors()?.filter((sponsor) => sponsor.tier === tier.id)}>
                                {(sponsor) => (
                                    <div class="sponsor-recognition">
                                        <a
                                            class="sponsor-logo"
                                            href={sponsor.profileUrl ?? sponsor.website}
                                            target="_blank"
                                            rel="noreferrer"
                                            title={sponsor.name}
                                        >
                                            <Show
                                                when={sponsor.logoUrl}
                                                fallback={<span>{sponsor.name}</span>}
                                            >
                                                <Image
                                                    src={sponsor.logoUrl}
                                                    darkSrc={sponsor.logoDarkUrl}
                                                    alt={sponsor.name}
                                                    loading="lazy"
                                                />
                                            </Show>
                                        </a>
                                        <SocialLinks
                                            name={sponsor.name}
                                            profiles={sponsor.socials ?? {}}
                                        />
                                    </div>
                                )}
                            </For>
                            <Show
                                when={
                                    !props.isFullPage &&
                                    sponsors() &&
                                    !sponsors()!.some((sponsor) => sponsor.tier === tier.id)
                                }
                            >
                                <a
                                    class="sponsor-logo sponsor-vacancy"
                                    href={`/sponsor?tier=${tier.id}`}
                                    aria-label={`Choose ${tier.name} sponsorship`}
                                >
                                    <span aria-hidden="true">+</span>
                                </a>
                            </Show>
                        </div>
                    </section>
                )}
            </For>
            <PersonalSponsors />
            <Show when={!props.isFullPage}>
                <div class="sponsor-action">
                    <a class="button button--primary" href="/sponsor">
                        Become a sponsor
                    </a>
                </div>
            </Show>
        </Card>
    );
}
