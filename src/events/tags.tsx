import "./entry.css";
import { For, Show } from "solid-js";

/** Link series to their own pages and topics to filtered events. */
export function EventTags(props: { series?: { slug: string; name: string }; topics?: string[] }) {
    return (
        <div class="event-taxonomy">
            <Show when={props.series}>
                {(series) => (
                    <a class="tag" href={`/series/${series().slug}`}>
                        {series().name}
                    </a>
                )}
            </Show>
            <For each={props.topics?.filter((topic) => topic !== props.series?.slug)}>
                {(topic) => (
                    <a class="tag" href={`/events?tag=${encodeURIComponent(topic)}`}>
                        {topic}
                    </a>
                )}
            </For>
        </div>
    );
}
