import { Highlight } from "../../../components/highlight";
import { useSearch } from "../../../search/local";
import { matchesSearch } from "../../../search/search";
import { EditLink } from "../../../auth/edit";
import { Image } from "../../../components/image";
import { getDirectory } from "../../../organisations/queries";
import { Arrow } from "../../../components/arrow";
import { createAsync } from "@solidjs/router";
import { For, Show } from "solid-js";

import { Card } from "../../../components/card";
import { Page } from "../../page";
import { Seo } from "../../seo";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => getDirectory(),
};

/** Discover the organisations building and gathering in Zurich. */
export default function Route() {
    const directory = createAsync(() => getDirectory());
    const { query: search, setQuery: setSearch, terms } = useSearch();
    const matches = () =>
        directory()?.organisations.filter((item) =>
            matchesSearch(`${item.name} ${item.description} ${item.location}`, terms()),
        ) ?? [];

    return (
        <>
            <Seo
                title="Organisations"
                description="Companies, labs, communities, and spaces in Zurich’s tech community."
            />
            <Page>
                <div class="listing-layout">
                    <Card
                        title="Organisations"
                        heading="h1"
                        class="listing-card"
                        toolbar={<EditLink href="/admin?section=organisations" label="Manage" />}
                    >
                        <div class="listing-filters">
                            <input
                                aria-label="Search organisations"
                                placeholder="Find an organisation…"
                                value={search()}
                                onInput={(event) => setSearch(event.currentTarget.value)}
                            />
                        </div>
                        <For each={matches()}>
                            {(item) => (
                                <a class="organisation-entry" href={`/organisations/${item.slug}`}>
                                    <div class="organisation-entry-logo">
                                        <Show when={item.logoUrl} fallback={item.name.slice(0, 2)}>
                                            <Image
                                                src={item.logoUrl}
                                                darkSrc={item.logoDarkUrl}
                                                alt=""
                                                loading="lazy"
                                            />
                                        </Show>
                                    </div>
                                    <div class="organisation-entry-copy">
                                        <h2>
                                            <Highlight text={item.name} terms={terms()} />
                                        </h2>
                                        <Show when={item.description}>
                                            <p>
                                                <Highlight
                                                    text={item.description}
                                                    terms={terms()}
                                                />
                                            </p>
                                        </Show>
                                        <div class="tags">
                                            <span class="tag">
                                                {
                                                    {
                                                        company: "Company",
                                                        lab: "Lab",
                                                        community: "Community",
                                                        space: "Space",
                                                    }[item.kind]
                                                }
                                            </span>
                                            <Show when={item.location}>
                                                <span class="tag">{item.location}</span>
                                            </Show>
                                            <Show when={item.isSponsor}>
                                                <span class="tag sponsorship-badge">
                                                    {item.sponsorTier ?? "Sponsor"}
                                                </span>
                                            </Show>
                                        </div>
                                    </div>
                                    <Arrow />
                                </a>
                            )}
                        </For>
                        <Show when={directory() && matches().length === 0}>
                            <p class="empty-copy">
                                {directory()!.organisations.length
                                    ? "No organisations match your search."
                                    : "No organisations listed yet."}
                            </p>
                        </Show>
                    </Card>
                    <aside class="listing-sidebar">
                        <Card title="Map">
                            <p>Explore the organisations around Zurich.</p>
                            <a class="button button--primary" href="/map">
                                Explore the map
                            </a>
                        </Card>
                    </aside>
                </div>
            </Page>
        </>
    );
}
