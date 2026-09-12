import { createEffect, createSignal, createUniqueId, For, onCleanup, Show } from "solid-js";
import { searchPlaces, type Place } from "../map/search";
import { VenueMap } from "../map/venue";
import "./address.css";

/** Search for an address while retaining manual entries and online meeting links. */
export function AddressField(props: {
    /** Saved address and coordinates. */
    value?: { address?: string; latitude?: number; longitude?: number };
}) {
    const id = createUniqueId();
    const [text, setText] = createSignal("");
    const [coordinates, setCoordinates] = createSignal<{ latitude: number; longitude: number }>();
    const [results, setResults] = createSignal<Place[]>([]);
    const [isOpen, setOpen] = createSignal(false);
    const [active, setActive] = createSignal(-1);
    const [status, setStatus] = createSignal("");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;

    // hydrate revisions without searching or changing their saved coordinates
    createEffect(() => {
        cancel();
        setText(props.value?.address ?? "");
        const value = props.value;
        setCoordinates(
            value?.latitude !== undefined && value.longitude !== undefined
                ? { latitude: value.latitude, longitude: value.longitude }
                : undefined,
        );
        setResults([]);
        setOpen(false);
        setStatus("");
    });
    onCleanup(cancel);

    /** Cancel pending and in-flight suggestions. */
    function cancel() {
        clearTimeout(timer);
        request?.abort();
    }

    /** Clear stale coordinates and debounce a new search. */
    function change(value: string) {
        cancel();
        setText(value);
        setCoordinates(undefined);
        setResults([]);
        setActive(-1);
        setStatus("");
        setOpen(true);
        if (value.trim().length < 3 || /^https?:\/\//i.test(value.trim())) return;
        timer = setTimeout(() => void search(value.trim()), 400);
    }

    /** Display only results for the current search. */
    async function search(value: string) {
        const controller = new AbortController();
        request = controller;
        setStatus("Searching…");
        try {
            const places = await searchPlaces(value, controller.signal);
            if (controller.signal.aborted) return;
            setResults(places);
            setStatus(places.length ? "" : "No places found.");
        } catch {
            if (!controller.signal.aborted)
                setStatus("Address search is unavailable. Enter the address manually.");
        }
    }

    /** Apply the selected address and its map position together. */
    function select(place: Place) {
        cancel();
        setText(place.label);
        setCoordinates({ latitude: place.latitude, longitude: place.longitude });
        setOpen(false);
        setResults([]);
        setStatus("");
        setActive(-1);
    }

    return (
        <div class="address-field">
            <label for={id}>Address</label>
            <div class="address-field__search">
                <input
                    id={id}
                    name="address"
                    maxlength="500"
                    autocomplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={isOpen() && results().length > 0}
                    aria-controls={`${id}-results`}
                    aria-activedescendant={
                        isOpen() && active() >= 0 ? `${id}-${active()}` : undefined
                    }
                    value={text()}
                    placeholder="Search for an address"
                    onInput={(event) => change(event.currentTarget.value)}
                    onFocus={() => setOpen(true)}
                    onBlur={() => {
                        cancel();
                        setOpen(false);
                        setStatus("");
                        setActive(-1);
                    }}
                    onKeyDown={(event) => {
                        // keep arrow-key navigation and selection inside the suggestion list
                        if (
                            (event.key === "ArrowDown" || event.key === "ArrowUp") &&
                            results().length
                        ) {
                            event.preventDefault();
                            setOpen(true);
                            setActive((index) =>
                                event.key === "ArrowDown"
                                    ? (index + 1) % results().length
                                    : index <= 0
                                      ? results().length - 1
                                      : index - 1,
                            );
                            document
                                .getElementById(`${id}-${active()}`)
                                ?.scrollIntoView({ block: "nearest" });
                        } else if (event.key === "Enter" && isOpen()) {
                            event.preventDefault();
                            if (results().length) select(results()[Math.max(active(), 0)]);
                            else setOpen(false);
                        } else if (event.key === "Escape") {
                            event.preventDefault();
                            cancel();
                            setOpen(false);
                            setActive(-1);
                        }
                    }}
                />
                <Show when={isOpen() && results().length > 0}>
                    <ul
                        id={`${id}-results`}
                        role="listbox"
                        aria-label="Places"
                        class="address-field__results"
                    >
                        <For each={results()}>
                            {(place, index) => (
                                <li
                                    id={`${id}-${index()}`}
                                    role="option"
                                    aria-selected={active() === index()}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onMouseMove={() => setActive(index())}
                                    onClick={() => select(place)}
                                >
                                    {place.label}
                                </li>
                            )}
                        </For>
                    </ul>
                </Show>
            </div>
            <input type="hidden" name="latitude" value={coordinates()?.latitude ?? ""} />
            <input type="hidden" name="longitude" value={coordinates()?.longitude ?? ""} />
            <Show when={isOpen() && status()}>
                <p role="status">{status()}</p>
            </Show>
            <Show when={coordinates()}>
                {(point) => <VenueMap name={text()} coordinates={point()} />}
            </Show>
        </div>
    );
}
