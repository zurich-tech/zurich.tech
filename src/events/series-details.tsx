import { registerCommands } from "../search/actions";
import { useAccess } from "../auth/edit";
import { SeriesStatistics } from "./statistics";
import type { CalendarEntry } from "./queries";
import { Show } from "solid-js";
import { Markdown } from "../components/markdown";
import { EventTags } from "./tags";
import { Organisers, type OrganiserPerson } from "./organiser";
import "./series-details.css";

/** Give series descriptions and all organisers distinct, aligned places. */
export function SeriesDetails(props: {
    events?: CalendarEntry[];
    series: {
        _id?: string;
        name?: string;
        slug: string;
        description: string;
        topics: string[];
        organiser?: OrganiserPerson | null;
        coOrganisers?: OrganiserPerson[];
    };
}) {
    const access = useAccess();
    registerCommands(() =>
        props.series._id && access.canSeries(props.series._id)
            ? [
                  {
                      id: `series-edit-${props.series._id}`,
                      label: `Edit ${props.series.name ?? props.series.slug}`,
                      group: "Series actions",
                      href: `/admin?section=series&series=${props.series._id}`,
                  },
                  ...(access.canCreate(props.series._id)
                      ? [
                            {
                                id: `series-event-${props.series._id}`,
                                label: `New event in ${props.series.name ?? props.series.slug}`,
                                group: "Series actions",
                                href: `/submit?series=${props.series._id}`,
                            },
                        ]
                      : []),
              ]
            : [],
    );
    const topics = () => props.series.topics.filter((topic) => topic !== props.series.slug);
    return (
        <div class="series-details">
            <div class="series-description-tags">
                <Show when={props.series.description.trim()}>
                    <div class="series-description">
                        <Markdown source={props.series.description} />
                    </div>
                </Show>
                <Show when={topics().length}>
                    <div class="detail-tags">
                        <EventTags topics={topics()} />
                    </div>
                </Show>
            </div>
            <Show when={props.series.organiser || props.series.coOrganisers?.length}>
                <div class="series-organisers">
                    <div class="series-organisers-label">Organisers</div>
                    <Organisers
                        detailed
                        primary={props.series.organiser}
                        others={props.series.coOrganisers}
                    />
                </div>
            </Show>
            <Show when={props.events}>
                {(events) => <SeriesStatistics events={events()} now={Date.now()} />}
            </Show>
        </div>
    );
}
