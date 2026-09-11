import { Image } from "../../../components/image";
import { SocialLinks } from "../../../components/social";
import { JobEntry } from "../../../jobs/job";
import { getDirectory } from "../../../organisations/queries";
import { getJobs } from "../../../jobs/queries";
import { Arrow } from "../../../components/arrow";
import { Card } from "../../../components/card";
import { createAsync, useParams } from "@solidjs/router";
import { For, Show } from "solid-js";
import { Page, PageHeader, DetailList, DetailRow } from "../../page";
import { Seo } from "../../seo";
import { NotFound } from "../../notfound";

/** Present an organisation in the same card layout as event details. */
export default function Route() {
    const params = useParams();
    const directory = createAsync(() => getDirectory());
    const organisation = () => directory()?.organisations.find((item) => item.slug === params.slug);
    // load only the open jobs attached to this organisation
    const jobs = createAsync(() => {
        const current = organisation();
        return current ? getJobs(current._id) : Promise.resolve(undefined);
    });

    return (
        <Show when={organisation()} fallback={directory() ? <NotFound /> : null}>
            {(item) => (
                <>
                    <Seo title={item().name} description={item().description} />
                    <Page class="organisation-page">
                        <header class="event-heading">
                            <a class="eyebrow" href="/organisations">
                                <Arrow direction="left" /> Organisations
                            </a>
                            <PageHeader title={item().name} summary={item().headline} />
                            <div class="event-schedule">
                                <span>
                                    {
                                        {
                                            company: "Company",
                                            lab: "Research lab",
                                            community: "Community",
                                            space: "Space",
                                        }[item().kind]
                                    }
                                </span>
                                <span>{item().location}</span>
                            </div>
                        </header>
                        <div class="event-layout">
                            <div class="event-content">
                                <Card title="About">
                                    <p class="organisation-description">{item().description}</p>
                                </Card>
                                <Card title="Jobs">
                                    <For each={jobs()}>{(job) => <JobEntry job={job} />}</For>
                                    <Show when={jobs()?.length === 0}>
                                        <p class="text-soft">No open roles listed yet.</p>
                                    </Show>
                                </Card>
                                <Show when={item().locations.length > 0}>
                                    <Card title="Locations">
                                        <For each={item().locations}>
                                            {(location) => (
                                                <div class="organisation-location">
                                                    <h3>{location.name}</h3>
                                                    <p>
                                                        {[
                                                            location.address?.line1,
                                                            location.address?.postalCode,
                                                            location.address?.locality,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(", ")}
                                                    </p>
                                                    <div class="organisation-location-links">
                                                        <a class="text-link" href="/map">
                                                            Community map <Arrow />
                                                        </a>
                                                        <Show
                                                            when={
                                                                location.address?.latitude !==
                                                                    undefined &&
                                                                location.address?.longitude !==
                                                                    undefined
                                                            }
                                                        >
                                                            <a
                                                                class="text-link"
                                                                href={`https://www.google.com/maps/dir/?api=1&destination=${location.address!.latitude},${location.address!.longitude}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                            >
                                                                Directions{" "}
                                                                <Arrow direction="external" />
                                                            </a>
                                                        </Show>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </Card>
                                </Show>
                            </div>
                            <aside class="event-aside">
                                <Card title="Links">
                                    <Show when={item().logoUrl}>
                                        <a
                                            href={item().website}
                                            target="_blank"
                                            rel="noreferrer"
                                            aria-label={`${item().name} website`}
                                        >
                                            <Image
                                                class="organisation-profile-logo"
                                                src={item().logoUrl}
                                                darkSrc={item().logoDarkUrl}
                                                alt={item().name}
                                            />
                                        </a>
                                    </Show>
                                    <a
                                        class="button button--ghost"
                                        href={item().website}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Visit website <Arrow direction="external" />
                                    </a>
                                    <SocialLinks
                                        name={item().name}
                                        profiles={item().socials ?? {}}
                                    />
                                </Card>
                                <Show when={item().isSponsor}>
                                    <Card title="Sponsorship">
                                        <DetailList>
                                            <DetailRow
                                                label="Sponsor"
                                                value={
                                                    item().sponsorTier
                                                        ? item()
                                                              .sponsorTier!.charAt(0)
                                                              .toUpperCase() +
                                                          item().sponsorTier!.slice(1)
                                                        : "Active"
                                                }
                                            />
                                        </DetailList>
                                        <a class="text-link" href="/sponsor">
                                            Our sponsors <Arrow />
                                        </a>
                                    </Card>
                                </Show>
                            </aside>
                        </div>
                    </Page>
                </>
            )}
        </Show>
    );
}
