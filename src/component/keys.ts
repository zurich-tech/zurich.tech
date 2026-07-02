import { useNavigate } from "@solidjs/router";
import { onCleanup, onMount } from "solid-js";

/** Accelerator key to route, TUI style. */
const accelerators: Record<string, string> = {
    e: "/events",
    s: "/series",
    m: "/members",
    b: "/blog",
    l: "/settings",
};

/** True when a form control owns the keyboard. */
export function isTyping(): boolean {
    const tag = document.activeElement?.tagName ?? "";
    return /^(input|textarea|select)$/i.test(tag);
}

/** Wire global TUI keys: accelerators plus j/k/enter row selection. */
export function useKeys() {
    const navigate = useNavigate();

    onMount(() => {
        // move focus through the row listing, enter activates the focused link natively
        function selectRow(step: number) {
            const rows = [...document.querySelectorAll<HTMLElement>("[data-row]")];
            if (rows.length === 0) {
                return;
            }

            const current = rows.indexOf(document.activeElement as HTMLElement);
            const next = Math.max(0, Math.min(rows.length - 1, current + step));
            rows[next].focus();
        }

        // dispatch bare keys, leaving chords and form input alone
        function onKey(event: KeyboardEvent) {
            if (event.metaKey || event.ctrlKey || event.altKey || isTyping()) {
                return;
            }

            // row selection
            if (event.key === "j") {
                selectRow(1);
            } else if (event.key === "k") {
                selectRow(-1);
            }
            // accelerators
            else if (accelerators[event.key] !== undefined) {
                navigate(accelerators[event.key]);
            }
        }

        addEventListener("keydown", onKey);
        onCleanup(() => removeEventListener("keydown", onKey));
    });
}
