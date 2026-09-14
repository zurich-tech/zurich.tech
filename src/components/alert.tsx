import { Show, type JSX } from "solid-js";
import "./alert.css";

/** Present actionable feedback with consistent spacing, hierarchy and accessible announcements. */
export function Alert(props: {
    tone: "error" | "warning" | "success";
    title?: string;
    children: JSX.Element;
}) {
    return (
        <div
            class={`alert alert--${props.tone}`}
            role={props.tone === "error" ? "alert" : "status"}
        >
            <svg
                class="alert__icon"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >
                <circle cx="12" cy="12" r="9" />
                <Show when={props.tone === "success"} fallback={<path d="M12 7v6m0 4h.01" />}>
                    <path d="m8 12 3 3 5-6" />
                </Show>
            </svg>
            <div class="alert__content">
                <Show when={props.title}>
                    <strong>{props.title}</strong>
                </Show>
                <div>{props.children}</div>
            </div>
        </div>
    );
}
