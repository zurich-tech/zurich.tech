import { For } from "solid-js";
import { Card } from "./card";
import "./facets.css";

/** One entry in a sidebar facet: where it leads and what it counts. */
export type Facet = {
    label: string;
    href: string;
    /** A count, date or short status shown on the right. */
    meta: string;
    isSelected?: boolean;
    /** Emphasise entries that need attention, such as an upcoming date. */
    isHighlighted?: boolean;
};

/** Browse a collection by one facet, with a count or date beside each entry. */
export function FacetList(props: { title: string; titleHref?: string; facets: Facet[] }) {
    return (
        <Card title={props.title} titleHref={props.titleHref} class="facet-card">
            <ul class="facet-list">
                <For each={props.facets}>
                    {(facet) => (
                        <li>
                            <a
                                href={facet.href}
                                classList={{ selected: facet.isSelected }}
                                aria-current={facet.isSelected ? "page" : undefined}
                            >
                                <span>{facet.label}</span>
                                <small classList={{ "is-highlighted": facet.isHighlighted }}>
                                    {facet.meta}
                                </small>
                            </a>
                        </li>
                    )}
                </For>
            </ul>
        </Card>
    );
}
