import type { JSX } from "solid-js";

const inputClasses =
    "w-full min-w-0 border border-line bg-transparent px-3 py-2 text-sm outline-none placeholder:text-soft/70 focus:border-ink";

/** Field, a labelled form control. */
export function Field(props: { children: JSX.Element; label: string }) {
    return (
        <label class="grid gap-1.5">
            <span class="text-xs lowercase text-soft">{props.label}</span>
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
    return <textarea {...props} class={`${inputClasses} min-h-28`} />;
}

/** Select input. */
export function Select(props: JSX.SelectHTMLAttributes<HTMLSelectElement>) {
    return <select {...props} class={inputClasses} />;
}
