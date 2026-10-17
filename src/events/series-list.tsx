import { FacetList } from "../components/facets";
import { timeZone } from "../../convex/events/time";
import type { CalendarEntry } from "./queries";

/** Day and month of a series' next event in Zurich time. */
const nextDate = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" });

/** List every active series with its next date or the number of events it has held. */
export function SeriesList(props: {
    series: { _id: string; slug: string; name: string }[];
    entries: CalendarEntry[];
    now: number;
}) {
    // summarise each series from the public calendar
    const rows = () =>
        props.series
            .map((series) => {
                const events = props.entries.filter(
                    (entry) =>
                        entry.seriesId === series._id &&
                        (entry.status === "scheduled" || entry.status === "finished"),
                );
                const next = events
                    .filter((entry) => entry.startsAt >= props.now)
                    .sort((left, right) => left.startsAt - right.startsAt)
                    .at(0);
                const held = events.filter((entry) => entry.startsAt < props.now).length;
                return { ...series, next, held };
            })
            .filter((series) => series.next || series.held > 0)
            .sort(
                (left, right) =>
                    (left.next?.startsAt ?? Infinity) - (right.next?.startsAt ?? Infinity) ||
                    right.held - left.held,
            );

    return (
        <FacetList
            title="Series"
            titleHref="/series"
            facets={rows().map((series) => ({
                label: series.name,
                href: `/series/${series.slug}`,
                meta: series.next ? nextDate.format(series.next.startsAt) : `${series.held} held`,
                isHighlighted: !!series.next,
            }))}
        />
    );
}
