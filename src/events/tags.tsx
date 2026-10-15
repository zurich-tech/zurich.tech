import { getTopics } from "../topics/queries";
import "./entry.css";
import { For, Show, type JSX } from "solid-js";
import type { Doc } from "../../convex/_generated/dataModel";
import { isTentative } from "../../convex/events/conditions";

/** Link series to their own pages and topics to filtered events. */
export function EventTags(props: {
    series?: { slug: string; name: string };
    topics?: string[];
    detailed?: boolean;
    children?: JSX.Element;
}) {
    const catalogue = getTopics.use(() => []);
    const label = (slug: string) => catalogue()?.find((topic) => topic.slug === slug)?.name;

    return (
        <div class="event-taxonomy" classList={{ "detail-tags": props.detailed }}>
            {props.children}
            <Show when={props.series}>
                {(series) => (
                    <a class="tag" href={`/series/${series().slug}`}>
                        {series().name}
                    </a>
                )}
            </Show>
            <For
                each={
                    catalogue() ? props.topics?.filter((topic) => topic !== props.series?.slug) : []
                }
            >
                {(topic) => (
                    <a class="tag" href={`/events?tag=${encodeURIComponent(topic)}`}>
                        {label(topic)}
                    </a>
                )}
            </For>
        </div>
    );
}

/** Keep event state and partnership consistent across views. */
export function EventBadges(props: {
    event: Pick<Doc<"events">, "status" | "startsAt" | "confirmation" | "confirmedAt">;
    now?: number;
    showPast?: boolean;
    isPartner?: boolean;
}) {
    // Use the same state precedence in list entries and expanded introductions.
    const state = () => {
        if (props.event.status === "cancelled") return "Cancelled";
        if (props.event.status === "draft") return "Draft";
        if (props.event.startsAt <= (props.now ?? Date.now()))
            return props.showPast ? "Past" : undefined;

        return isTentative(props.event) ? "Tentative" : "Upcoming";
    };
    return (
        <>
            <Show when={state()}>
                {(label) => (
                    <span
                        class="tag tag-status"
                        classList={{
                            "tag-upcoming": label() === "Upcoming" || label() === "Tentative",
                        }}
                    >
                        {label()}
                    </span>
                )}
            </Show>
            <Show when={props.isPartner}>
                <span class="tag tag-status tag-upcoming">Partner</span>
            </Show>
        </>
    );
}
