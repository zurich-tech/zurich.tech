import type { JSX } from "solid-js";

const styles = {
    primary: "button--primary",
    ghost: "button--ghost",
};

/** Button, a link or submit rendered as a bordered mono label. */
export function Button(props: {
    children: JSX.Element;
    href?: string;
    kind?: "primary" | "ghost";
    type?: "submit" | "button";
}) {
    // shared classes
    const classes = () => `button ${styles[props.kind ?? "primary"]}`;

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
