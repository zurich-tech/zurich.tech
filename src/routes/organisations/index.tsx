import { Image } from "../../component/image";
import { getDirectory } from "../../core/queries";
import { Arrow } from "../../component/arrow";
import { createAsync } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";

import { Card } from "../../component/card";
import { Page } from "../../component/page";
import { Seo } from "../../component/seo";

/** Discover the organisations building and gathering in Zürich. */
export default function Route() {
    const directory = createAsync(() => getDirectory());
    const [search, setSearch] = createSignal("");
    const [kind, setKind] = createSignal("all");
    const matches = () =>
        directory()?.organisations.filter(
            (item) =>
                (kind() === "all" || item.kind === kind()) &&
                `${item.name} ${item.description} ${item.location}`
                    .toLowerCase()
                    .includes(search().toLowerCase()),
        ) ?? [];

    return (
        <>
            <Seo
                title="Organisations"
                description="Companies, labs, communities, and spaces in Zürich’s tech community."
            />
            <Page>
                <div class="listing-layout">
                    <Card
                        title="Organisations"
                        heading="h1"
                        meta={matches().length}
                        class="listing-card"
                    >
                        <div class="listing-filters">
                            <input
                                aria-label="Search organisations"
                                placeholder="Find an organisation…"
                                value={search()}
                                onInput={(event) => setSearch(event.currentTarget.value)}
                            />
                            <select
                                aria-label="Organisation type"
                                value={kind()}
                                onChange={(event) => setKind(event.currentTarget.value)}
                            >
                                <option value="all">All organisations</option>
                                <option value="company">Companies</option>
                                <option value="lab">Labs</option>
                                <option value="community">Communities</option>
                                <option value="space">Spaces</option>
                            </select>
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
                                        <h2>{item.name}</h2>
                                        <Show when={item.description}>
                                            <p>{item.description}</p>
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
                                                <span class="tag">Sponsor</span>
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
                                    ? "No organisations match these filters."
                                    : "No organisations listed yet."}
                            </p>
                        </Show>
                    </Card>
                    <aside class="listing-sidebar">
                        <Card title="Map">
                            <p>Explore the organisations around Zürich.</p>
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
