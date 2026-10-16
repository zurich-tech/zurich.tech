import { createMemo, For, Show, type JSX } from "solid-js";
import { EventEntry } from "./entry";
import type { CalendarEntry, GalleryAlbum } from "./queries";
import { Image } from "../components/image";

/** Render the same timeline, metadata and row spacing wherever events are listed. */
export function EventList<T extends CalendarEntry>(props: {
    events: T[];
    /** Approved album previews, when the containing page requests photos. */
    albums?: GalleryAlbum[];
    series: { _id: string; slug: string; name: string }[];
    now: number;
    terms?: readonly string[];
    excerpts?: Record<string, string>;
    showToday?: boolean;
    actions?: (event: T) => JSX.Element;
}) {
    // index albums once so filtering does not repeatedly scan the photo collection
    const albums = createMemo(
        () => new Map((props.albums ?? []).map((album) => [album.href, album])),
    );

    return (
        <ol class="event-list">
            <For each={props.events}>
                {(event, index) => (
                    <li>
                        <Show
                            when={
                                props.showToday &&
                                index() > 0 &&
                                event.startsAt < props.now !==
                                    props.events[index() - 1].startsAt < props.now
                            }
                        >
                            <div class="programme-today">
                                <span>Today</span>
                            </div>
                        </Show>
                        <EventEntry
                            event={event}
                            terms={props.terms}
                            description={props.excerpts?.[event.href]}
                            now={props.now}
                            series={props.series.find((series) => series._id === event.seriesId)}
                            actions={props.actions?.(event)}
                        />
                        <Show
                            when={
                                event.startsAt < props.now && albums().get(`${event.href}#photos`)
                            }
                        >
                            {(album) => (
                                <a
                                    class="event-photos"
                                    href={album().href}
                                    aria-label={`Photos from ${event.title}`}
                                >
                                    <For each={album().images.slice(0, 3)}>
                                        {(photo) => (
                                            <Image
                                                src={photo.thumbnailUrl}
                                                alt={photo.alt}
                                                width={photo.width}
                                                height={photo.height}
                                                loading="lazy"
                                            />
                                        )}
                                    </For>
                                </a>
                            )}
                        </Show>
                    </li>
                )}
            </For>
        </ol>
    );
}
