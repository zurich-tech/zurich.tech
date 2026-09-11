import type { JSX } from "solid-js";

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
    return <input {...props} class={inputClasses} />;
}

/** Multiline input. */
export function Textarea(props: JSX.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return <textarea {...props} class={`${inputClasses} field__textarea`} />;
}

/** Select input. */
export function Select(props: JSX.SelectHTMLAttributes<HTMLSelectElement>) {
    return <select {...props} class={inputClasses} />;
}
