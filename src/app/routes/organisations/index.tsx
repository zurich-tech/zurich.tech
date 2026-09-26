import { organisationKinds } from "../../../../convex/organisations/kinds";
import { Highlight } from "../../../components/highlight";
import { useSearch } from "../../../search/local";
import { matchesSearch } from "../../../search/search";
import { EditLink } from "../../../auth/edit";
import { Image } from "../../../components/image";
import { getDirectory } from "../../../organisations/queries";
import { Arrow } from "../../../components/arrow";
import { For, Show } from "solid-js";

import { TableToolbar } from "../../../components/toolbar";
import { Card } from "../../../components/card";
import { FacetList } from "../../../components/facets";
import { useSearchParams } from "@solidjs/router";
import { Page } from "../../page";
import { Seo } from "../../seo";
import "../../../organisations/organisations.css";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => getDirectory(),
};

/** Discover the organisations building and gathering in Zurich. */
export default function Route() {
    const directory = getDirectory.use(() => []);
    const [params] = useSearchParams();
    const kind = () => (typeof params.kind === "string" ? params.kind : undefined);
    const { query: search, setQuery: setSearch, terms } = useSearch();
    const matches = () =>
        directory()?.organisations.filter(
            (item) =>
                (!kind() || item.kind === kind()) &&
                matchesSearch(
                    `${item.name} ${item.headline ?? ""} ${item.description} ${item.location}`,
                    terms(),
                ),
        ) ?? [];

    // count organisations of each kind present in the directory
    const kinds = () =>
        Object.entries(organisationKinds)
            .map(([value, label]) => ({
                value,
                label,
                count: directory()?.organisations.filter((item) => item.kind === value).length ?? 0,
            }))
            .filter((entry) => entry.count > 0);

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
                        <TableToolbar
                            value={search()}
                            onSearch={setSearch}
                            placeholder="Search organisations…"
                        />
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
                                        <Show when={item.headline}>
                                            <p>
                                                <Highlight text={item.headline!} terms={terms()} />
                                            </p>
                                        </Show>
                                        <div class="tags">
                                            <span class="tag">{organisationKinds[item.kind]}</span>
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
                    {/* browse by kind, then find them on the map */}
                    <aside class="listing-sidebar">
                        <FacetList
                            title="Kinds"
                            facets={[
                                {
                                    label: "All organisations",
                                    href: "/organisations",
                                    meta: String(directory()?.organisations.length ?? 0),
                                    isSelected: !kind(),
                                },
                                ...kinds().map((entry) => ({
                                    label: entry.label,
                                    href: `/organisations?kind=${entry.value}`,
                                    meta: String(entry.count),
                                    isSelected: kind() === entry.value,
                                })),
                            ]}
                        />
                        <Card title="On the map" titleHref="/map" class="offer-card">
                            <p>See where Zurich's tech organisations work, and add your own.</p>
                            <a class="button button--primary" href="/map">
                                Explore the map
                            </a>
                            <a class="text-link" href="/manage">
                                Add your organisation
                            </a>
                        </Card>
                    </aside>
                </div>
            </Page>
        </>
    );
}
