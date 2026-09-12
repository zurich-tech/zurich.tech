import { createSignal, For, Show } from "solid-js";
import "./rating.css";

/** Display or choose an optional five-star rating. */
export function Rating(props: {
    value?: number;
    label?: string;
    disabled?: boolean;
    onChange?: (value: number | undefined) => void;
}) {
    const [preview, setPreview] = createSignal<number>();
    const highlighted = () => preview() ?? props.value ?? 0;

    return (
        <div
            class="rating"
            role={props.onChange ? "group" : "img"}
            aria-label={
                props.onChange ? (props.label ?? "Rating") : `${props.value ?? 0} out of 5 stars`
            }
            onPointerLeave={() => setPreview(undefined)}
        >
            <For each={[1, 2, 3, 4, 5]}>
                {(value) => (
                    <Show
                        when={props.onChange}
                        fallback={<Star filled={value <= (props.value ?? 0)} />}
                    >
                        <button
                            type="button"
                            class="rating-star"
                            aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                            aria-pressed={props.value === value}
                            disabled={props.disabled}
                            onPointerEnter={() => !props.disabled && setPreview(value)}
                            onFocus={() => setPreview(value)}
                            onBlur={() => setPreview(undefined)}
                            onClick={() => {
                                props.onChange?.(props.value === value ? undefined : value);
                                setPreview(undefined);
                            }}
                        >
                            <Star filled={value <= highlighted()} />
                        </button>
                    </Show>
                )}
            </For>
        </div>
    );
}

/** Keep the same star geometry in editable and read-only ratings. */
function Star(props: { filled: boolean }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" classList={{ "rating-filled": props.filled }}>
            <path d="m12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 17.19l-5.56 2.93 1.06-6.2L3 9.53l6.22-.9Z" />
        </svg>
    );
}
