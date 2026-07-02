import type { JSX } from "solid-js";

/** Badge, a bracketed status label. */
export function Badge(props: { children: JSX.Element }) {
    return (
        <span class="inline-flex text-xs lowercase whitespace-nowrap text-soft">
            [{props.children}]
        </span>
    );
}
