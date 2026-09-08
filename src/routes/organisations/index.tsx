import { getDirectory } from "../../core/queries";
import { Arrow } from "../../component/arrow";
import { createAsync } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";

import { Page, PageHeader } from "../../component/page";
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
                <PageHeader title="Organisations" />
                <p class="page-lead">Local companies, research labs, communities, and spaces.</p>
                <div class="filter-bar">
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
                <div class="organisation-grid">
                    <For each={matches()}>
                        {(item) => (
                            <a class="organisation-card" href={`/organisations/${item.slug}`}>
                                <div class="organisation-monogram">
                                    {item.name.slice(0, 2)}
                                    <Arrow direction="external" />
                                </div>
                                <p class="eyebrow">
                                    {item.kind}{" "}
                                    <Show when={item.isSponsor}> · COMMUNITY SUPPORTER</Show>
                                </p>
                                <h2>{item.name}</h2>
                                <p>{item.description}</p>
                                <span class="eyebrow">{item.location}</span>
                            </a>
                        )}
                    </For>
                </div>
                <Show when={directory() && matches().length === 0}>
                    <div class="empty-panel">
                        <h2>{search() ? "No matches yet." : "No organisations listed yet."}</h2>
                        <p>Contact the team to add an organisation.</p>
                        <a class="text-link" href="/sponsor">
                            Get in touch <Arrow direction="external" />
                        </a>
                    </div>
                </Show>
            </Page>
        </>
    );
}
