import type { JSX } from "solid-js";

const styles = {
    primary: "button--primary",
    ghost: "button--ghost",
};

/** Button, a link or submit rendered as a bordered mono label. */
export function Button(props: {
    children: JSX.Element;
    disabled?: boolean;
    href?: string;
    kind?: "primary" | "ghost";
    onClick?: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
    type?: "submit" | "button";
}) {
    // shared classes
    const classes = () => `button ${styles[props.kind ?? "primary"]}`;

    // render as link
    if (props.href !== undefined) {
        return (
            <a
                class={classes()}
                href={props.disabled ? undefined : props.href}
                aria-disabled={props.disabled || undefined}
                tabindex={props.disabled ? -1 : undefined}
            >
                {props.children}
            </a>
        );
    }

    return (
        <button
            class={classes()}
            disabled={props.disabled}
            onClick={props.onClick}
            type={props.type ?? "submit"}
        >
            {props.children}
        </button>
    );
}
