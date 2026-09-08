/** Draw the shared directional icon at a fixed size and stroke weight. */
export function Arrow(props: { direction?: "right" | "left" | "down" | "external" }) {
    const rotation = () =>
        ({ right: 0, left: 180, down: 90, external: -45 })[props.direction ?? "right"];

    return (
        <svg
            class="arrow-icon"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            style={{ transform: `rotate(${rotation()}deg)` }}
        >
            <path
                d="M3 8h10M8 3l5 5-5 5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    );
}
