import type { JSX } from "solid-js";

const styles = {
    primary: "border-ink bg-ink text-paper hover:bg-transparent hover:text-ink",
    ghost: "border-line text-ink hover:border-ink",
};

/** Button, a link or submit rendered as a bordered mono label. */
export function Button(props: {
    children: JSX.Element;
    href?: string;
    kind?: "primary" | "ghost";
    type?: "submit" | "button";
}) {
    // shared classes
    const classes = () =>
        `inline-flex shrink-0 border px-3 py-1.5 text-sm lowercase ${styles[props.kind ?? "primary"]}`;

    // render as link
    if (props.href !== undefined) {
        return (
            <a class={classes()} href={props.href}>
                {props.children}
            </a>
        );
    }

    return (
        <button class={classes()} type={props.type ?? "submit"}>
            {props.children}
        </button>
    );
}
