import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { GalleryAlbum } from "./queries";
import { Card } from "../components/card";
import { FilterPills } from "../components/filter-pills";
import { Image } from "../components/image";

/** Browse recent event albums with gently rotating photo previews. */
export function Gallery(props: {
    /** Recent event destinations and their approved photographs. */
    albums: GalleryAlbum[];
    /** Show the complete album collection on its own page. */
    isPage?: boolean;
}) {
    const [year, setYear] = createSignal("all");
    const years = createMemo(() =>
        [...new Set(props.albums.map((album) => album.year))].sort((a, b) => a - b),
    );
    const albums = createMemo(() =>
        props.albums.filter((album) => year() === "all" || String(album.year) === year()),
    );
    const [frame, setFrame] = createSignal(0);
    const [isPaused, setPaused] = createSignal(props.isPage ?? false);
    const [isHovered, setHovered] = createSignal(false);
    const [isFocused, setFocused] = createSignal(false);
    let lastAdvance = 0;
    const hasSlideshow = () =>
        (!props.isPage && albums().length > 3) || albums().some((album) => album.images.length > 1);

    // keep three event previews on the homepage and cycle through the whole collection
    const visibleAlbums = createMemo(() => {
        if (props.isPage || albums().length <= 3) return albums();
        const count = albums().length;
        const start = ((frame() % count) + count) % count;
        return Array.from({ length: 3 }, (_, index) => albums()[(start + index) % count]);
    });

    /** Advance every album together and leave a full interval before autoplay resumes. */
    function advance(direction: number) {
        lastAdvance = Date.now();
        setFrame((value) => value + direction);
    }

    /** Wrap backwards as well as forwards, including albums with different lengths. */
    function photoIndex(length: number) {
        const round =
            !props.isPage && albums().length > 3 ? Math.floor(frame() / albums().length) : frame();
        return ((round % length) + length) % length;
    }

    // respect motion preferences and stop the timer when the gallery unmounts
    onMount(() => {
        const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
        const updateMotion = () => {
            if (motion.matches) setPaused(true);
        };
        updateMotion();
        motion.addEventListener("change", updateMotion);
        const timer = window.setInterval(() => {
            if (
                !isPaused() &&
                !isHovered() &&
                !isFocused() &&
                Date.now() - lastAdvance >= 10000 &&
                !document.hidden
            ) {
                advance(1);
            }
        }, 10000);
        onCleanup(() => {
            window.clearInterval(timer);
            motion.removeEventListener("change", updateMotion);
        });
    });

    return (
        <Card
            title="Photos"
            titleHref={props.isPage ? undefined : "/photos"}
            heading={props.isPage ? "h1" : "h2"}
            class={props.isPage ? "gallery-overview gallery-overview--page" : "gallery-overview"}
            toolbar={
                <Show when={hasSlideshow()}>
                    <div class="gallery-controls" role="group" aria-label="Photo playback">
                        <button
                            type="button"
                            aria-label="Previous photos"
                            title="Previous photos"
                            onClick={() => advance(-1)}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M6 5v14" />
                                <path d="M18 5 8 12l10 7Z" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            aria-label={isPaused() ? "Play slideshow" : "Pause slideshow"}
                            title={isPaused() ? "Play slideshow" : "Pause slideshow"}
                            onClick={() => {
                                lastAdvance = Date.now();
                                setPaused(!isPaused());
                            }}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <Show
                                    when={isPaused()}
                                    fallback={
                                        <>
                                            <path d="M8 5v14M16 5v14" />
                                        </>
                                    }
                                >
                                    <path d="m8 5 11 7-11 7Z" />
                                </Show>
                            </svg>
                        </button>
                        <button
                            type="button"
                            aria-label="Next photos"
                            title="Next photos"
                            onClick={() => advance(1)}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M18 5v14" />
                                <path d="m6 5 10 7-10 7Z" />
                            </svg>
                        </button>
                    </div>
                </Show>
            }
        >
            <div class="gallery-filters">
                <FilterPills
                    label="Photo year"
                    value={year()}
                    options={[
                        { value: "all", label: "All" },
                        ...years().map((year) => ({ value: String(year), label: String(year) })),
                    ]}
                    onChange={(value) => {
                        setYear(value);
                        setFrame(0);
                        lastAdvance = Date.now();
                    }}
                />
            </div>
            <div
                class="gallery-overview-grid"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onFocusIn={() => setFocused(true)}
                onFocusOut={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                        setFocused(false);
                }}
            >
                <For each={visibleAlbums()}>
                    {(album) => (
                        <a class="gallery-album" href={album.href}>
                            <div class="gallery-album-images">
                                <For each={album.images}>
                                    {(photo, index) => (
                                        <Image
                                            src={photo.thumbnailUrl}
                                            alt={photo.alt}
                                            width={photo.width}
                                            height={photo.height}
                                            loading="lazy"
                                            classList={{
                                                "is-active":
                                                    photoIndex(album.images.length) === index(),
                                            }}
                                            aria-hidden={
                                                photoIndex(album.images.length) !== index()
                                            }
                                        />
                                    )}
                                </For>
                            </div>
                            <span class="text-link">{album.title}</span>
                        </a>
                    )}
                </For>
            </div>
        </Card>
    );
}
