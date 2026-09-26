import { Image } from "./image";
import "./avatar.css";
import { Show, createEffect, createSignal } from "solid-js";

/** Display a provider portrait with initials when no image is available. */
export function Avatar(props: {
    /** Display name. */ name: string;
    /** Provider image URL. */ image?: string | null;
    /** Optional image for dark backgrounds. */ imageDark?: string;
}) {
    const [isFailed, setIsFailed] = createSignal(false);
    createEffect(() => {
        props.image;
        props.imageDark;
        setIsFailed(false);
    });

    return (
        <span class="avatar" aria-hidden="true">
            <Show
                when={props.image && !isFailed()}
                fallback={<span>{props.name.trim().slice(0, 2).toUpperCase()}</span>}
            >
                <Image
                    src={props.image!}
                    darkSrc={props.imageDark}
                    alt=""
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    onError={() => setIsFailed(true)}
                />
            </Show>
        </span>
    );
}
