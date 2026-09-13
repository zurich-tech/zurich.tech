import { createSignal, For } from "solid-js";
import { Dialog } from "../components/dialog";
import { Arrow } from "../components/arrow";
import { calendarLinks, type CalendarEvent } from "./calendar";

/** Choose a calendar service or download an interoperable calendar file. */
export function CalendarButton(props: { event: CalendarEvent }) {
    const [isOpen, setOpen] = createSignal(false);

    return (
        <>
            <button class="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
                Add to calendar
            </button>
            <Dialog
                isOpen={isOpen()}
                title="Add to calendar"
                onClose={() => setOpen(false)}
                actions={
                    <button class="button" onClick={() => setOpen(false)}>
                        Close
                    </button>
                }
            >
                <div class="calendar-options">
                    <For each={calendarLinks(props.event)}>
                        {(calendar) => (
                            <a
                                class="button"
                                href={calendar.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setOpen(false)}
                            >
                                {calendar.name} <Arrow direction="external" />
                            </a>
                        )}
                    </For>
                    <a
                        class="button"
                        href={`/calendar/${encodeURIComponent(props.event.slug)}`}
                        download={`${props.event.slug}.ics`}
                        onClick={() => setOpen(false)}
                    >
                        Download .ics <Arrow direction="down" />
                    </a>
                    <p>Apple Calendar and other calendar apps.</p>
                </div>
            </Dialog>
        </>
    );
}
