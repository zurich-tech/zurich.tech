import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { GalleryAlbum } from "../core/queries";
import { Card } from "./card";
import { Image } from "./image";

/** Browse recent event albums with gently rotating photo previews. */
export function Gallery(props: {
    /** Recent event destinations and their approved photographs. */
    albums: GalleryAlbum[];
}) {
    const [frame, setFrame] = createSignal(0);
    const [isPaused, setPaused] = createSignal(false);
    const [isHovered, setHovered] = createSignal(false);
    const [isFocused, setFocused] = createSignal(false);
    let lastAdvance = 0;
    const hasSlideshow = () => props.albums.some((album) => album.images.length > 1);

    /** Advance every album together and leave a full interval before autoplay resumes. */
    function advance(direction: number) {
        lastAdvance = Date.now();
        setFrame((value) => value + direction);
    }

    /** Wrap backwards as well as forwards, including albums with different lengths. */
    function photoIndex(length: number) {
        return ((frame() % length) + length) % length;
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
                Date.now() - lastAdvance >= 5000 &&
                !document.hidden
            ) {
                advance(1);
            }
        }, 5000);
        onCleanup(() => {
            window.clearInterval(timer);
            motion.removeEventListener("change", updateMotion);
        });
    });

    return (
        <Card
            title="Photos"
            class="gallery-overview"
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
                <For each={props.albums}>
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
