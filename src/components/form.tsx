import { Show } from "solid-js";

/** Visible form result announced to assistive technology. */
export function FormMessage(props: { error?: string; success?: string }) {
    return (
        <Show when={props.error ?? props.success}>
            <p
                aria-live="polite"
                classList={{
                    "form-error": props.error !== undefined,
                    "form-success": props.error === undefined,
                }}
            >
                {props.error ?? props.success}
            </p>
        </Show>
    );
}
