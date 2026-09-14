import { Show } from "solid-js";
import { Markdown } from "../components/markdown";
import { EventTags } from "./tags";
import { Organisers, type OrganiserPerson } from "./organiser";
import "./series-details.css";

/** Give series descriptions and all organisers distinct, aligned places. */
export function SeriesDetails(props: {
    series: {
        slug: string;
        description: string;
        topics: string[];
        organiser?: OrganiserPerson | null;
        coOrganisers?: OrganiserPerson[];
    };
}) {
    return (
        <div class="series-details">
            <div class="series-description">
                <Markdown source={props.series.description} />
                <EventTags
                    topics={props.series.topics.filter((topic) => topic !== props.series.slug)}
                />
            </div>
            <Show when={props.series.organiser || props.series.coOrganisers?.length}>
                <div class="series-organisers">
                    <div class="series-organisers-label">Organisers</div>
                    <Organisers
                        primary={props.series.organiser}
                        others={props.series.coOrganisers}
                    />
                </div>
            </Show>
        </div>
    );
}
