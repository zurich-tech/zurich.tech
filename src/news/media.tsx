import { Show, createSignal } from "solid-js";
import { Play } from "lucide-solid";
import { videoEmbed } from "./video";

/** Display original media; load video players only when requested. */
export function NewsMedia(props: { image?: string; video?: string }) {
    const embed = () => (props.video ? videoEmbed(props.video) : undefined);
    const [playing, setPlaying] = createSignal<string>();

    return (
        <Show
            when={props.video}
            fallback={
                <Show when={props.image}>
                    <img
                        class="news-image"
                        src={props.image}
                        alt=""
                        loading="lazy"
                        decoding="async"
                    />
                </Show>
            }
        >
            <Show
                when={embed()}
                fallback={
                    <video
                        class="news-image"
                        src={props.video}
                        poster={props.image}
                        controls
                        playsinline
                        preload="none"
                        aria-label="News video"
                    >
                        <a href={props.video}>Watch video</a>
                    </video>
                }
            >
                {(source) => (
                    <div class="news-video">
                        <Show
                            when={playing() === source()}
                            fallback={
                                <button
                                    class="news-video__play"
                                    type="button"
                                    aria-label="Play video"
                                    onClick={() => setPlaying(source())}
                                >
                                    <Show when={props.image}>
                                        <img src={props.image} alt="" loading="lazy" />
                                    </Show>
                                    <span>
                                        <Play size={28} aria-hidden="true" />
                                    </span>
                                </button>
                            }
                        >
                            <iframe
                                src={source()}
                                title="News video"
                                allow="autoplay; fullscreen; picture-in-picture"
                                allowfullscreen
                                referrerpolicy="strict-origin-when-cross-origin"
                            />
                        </Show>
                    </div>
                )}
            </Show>
        </Show>
    );
}
