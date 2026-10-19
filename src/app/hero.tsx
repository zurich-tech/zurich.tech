import wordmark from "../components/assets/wordmark.svg?raw";
import { CommunityMap } from "../map/map";
import { getCalendar } from "../events/queries";
import { getSubscriberCount } from "../statistics/queries";
import { createMemo } from "solid-js";
import { Users, CalendarDays } from "lucide-solid";

/** Open the homepage with the city map and wordmark. */
export function Hero() {
    // reuse the public catalogues already loaded for the homepage
    const members = getSubscriberCount.use(() => []);
    const events = getCalendar.use(() => []);
    const now = Date.now();
    const eventCount = createMemo(
        () =>
            events()?.filter(
                (event) => !event.isPartner && event.status !== "cancelled" && event.startsAt < now,
            ).length,
    );
    const format = (value: number | undefined) => value?.toLocaleString("en-CH") ?? "–";

    return (
        <header class="hero">
            {/* render the geographic map behind the wordmark */}
            <CommunityMap isHero />

            {/* keep community totals readable against the map at every width */}
            <nav class="hero-counts" aria-label="Community">
                <a href="/stats" title="Members" aria-label={`${format(members())} members`}>
                    <strong>{format(members())}</strong>
                    <Users aria-hidden="true" strokeWidth={1.5} />
                </a>
                <a
                    href="/events?period=past"
                    title="Events"
                    aria-label={`${format(eventCount())} events`}
                >
                    <CalendarDays aria-hidden="true" strokeWidth={1.5} />
                    <strong>{format(eventCount())}</strong>
                </a>
            </nav>

            {/* anchor the wordmark to the banner edges */}
            <h1 class="hero-wordmark" aria-label="zurich.tech" innerHTML={wordmark} />
        </header>
    );
}
