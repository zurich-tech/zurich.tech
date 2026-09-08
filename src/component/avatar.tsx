import { Show, createEffect, createSignal } from "solid-js";

/** Display a provider portrait with initials when no image is available. */
export function Avatar(props: {
    /** Display name. */ name: string;
    /** Provider image URL. */ image?: string | null;
}) {
    const [isFailed, setIsFailed] = createSignal(false);
    createEffect(() => {
        props.image;
        setIsFailed(false);
    });

    return (
        <span class="avatar" aria-hidden="true">
            <Show
                when={props.image && !isFailed()}
                fallback={<span>{props.name.trim().slice(0, 2).toUpperCase()}</span>}
            >
                <img
                    src={props.image!}
                    alt=""
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    onError={() => setIsFailed(true)}
                />
            </Show>
        </span>
    );
}
