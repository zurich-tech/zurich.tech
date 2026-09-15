import { createEffect, splitProps, type JSX } from "solid-js";

const inputClasses = "field__control";

/** Field, a labelled form control. */
export function Field(props: { children: JSX.Element; label: string }) {
    return (
        <label class="field">
            <span class="field__label">{props.label}</span>
            {props.children}
        </label>
    );
}

/** Text input. */
export function Input(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
    const [local, attributes] = splitProps(props, ["value", "ref", "class"]);
    let control!: HTMLInputElement;
    // restore authored values even when a conditional branch hydrates lazily
    createEffect(() => {
        if (local.value !== undefined) control.value = String(local.value);
    });

    return (
        <input
            {...attributes}
            value={local.value}
            ref={(element) => {
                control = element;
                if (typeof local.ref === "function") local.ref(element);
            }}
            class={[inputClasses, local.class].filter(Boolean).join(" ")}
        />
    );
}

/** Multiline input. */
export function Textarea(props: JSX.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    const [local, attributes] = splitProps(props, ["value", "ref", "class"]);
    let control!: HTMLTextAreaElement;
    // initialize hydrated values and follow deliberate changes to the bound record
    createEffect(() => {
        if (local.value !== undefined) control.value = String(local.value);
    });

    return (
        <textarea
            {...attributes}
            ref={(element) => {
                control = element;
                if (typeof local.ref === "function") local.ref(element);
            }}
            class={[inputClasses, "field__textarea", local.class].filter(Boolean).join(" ")}
        >
            {local.value}
        </textarea>
    );
}

/** Select input whose saved value is restored after its options mount. */
export function Select(props: JSX.SelectHTMLAttributes<HTMLSelectElement>) {
    const [local, attributes] = splitProps(props, ["value", "ref", "class"]);
    let control!: HTMLSelectElement;
    // native select has no value attribute, so initialize its actual selected option
    createEffect(() => {
        if (local.value !== undefined) control.value = String(local.value);
    });

    return (
        <select
            {...attributes}
            ref={(element) => {
                control = element;
                if (typeof local.ref === "function") local.ref(element);
            }}
            class={[inputClasses, local.class].filter(Boolean).join(" ")}
        />
    );
}
