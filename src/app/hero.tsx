import wordmark from "../components/assets/wordmark.svg?raw";
import { Show } from "solid-js";
import { CommunityMap } from "../map/map";
import { Arrow } from "../components/arrow";
import { timeZone } from "./site";
import type { CalendarEntry } from "../events/queries";

/** Weekday, date and time of the next event in Zurich time. */
const nextWhen = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
});

/** Format a conservative community milestone. */
function milestone(count: number, step: number) {
    return `${(Math.floor(count / step) * step).toLocaleString("en-GB")}+`;
}

/** Open the homepage with the city map, the next event, community figures and the wordmark. */
export function Hero(props: {
    /** Published events shown on the homepage. */
    eventCount?: number;
    /** Current community members with an active subscription. */
    memberCount?: number;
    /** The next upcoming event, if any. */
    next?: CalendarEntry;
}) {
    return (
        <header class="hero">
            {/* render the geographic map behind the wordmark */}
            <CommunityMap isHero />

            {/* the next event and the community figures as one row of equal chips */}
            <dl class="hero-chips">
                <Show when={props.next}>
                    {(next) => (
                        <div class="hero-chip hero-chip--next">
                            <dt>next up · {nextWhen.format(next().startsAt)}</dt>
                            <dd>
                                <a href={next().href} title={next().location}>
                                    {next().title}
                                    <Arrow />
                                </a>
                            </dd>
                        </div>
                    )}
                </Show>
                <Show when={props.eventCount !== undefined}>
                    <div class="hero-chip">
                        <dt>events</dt>
                        <dd>{milestone(props.eventCount!, 10)}</dd>
                    </div>
                </Show>
                <Show when={props.memberCount !== undefined}>
                    <div class="hero-chip">
                        <dt>members</dt>
                        <dd>{milestone(props.memberCount!, 1000)}</dd>
                    </div>
                </Show>
            </dl>

            {/* anchor the wordmark to the banner edges */}
            <h1 class="hero-wordmark" aria-label="zurich.tech" innerHTML={wordmark} />
        </header>
    );
}
