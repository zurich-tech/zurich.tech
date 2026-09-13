import { useUnsavedChanges } from "./unsaved";
import {
    onMount,
    onCleanup,
    Show,
    splitProps,
    createSignal,
    createEffect,
    type JSX,
} from "solid-js";

/** Group related controls with a consistent heading and divider. */
export function FormSection(props: { title: string; children: JSX.Element }) {
    return (
        <section class="form-section">
            <h3>{props.title}</h3>
            {props.children}
        </section>
    );
}

/** Keep dependent values while excluding disabled options from validation and submission. */
export function OptionalFields(props: {
    name: string;
    label: string;
    checked?: boolean;
    children: JSX.Element;
}) {
    const [enabled, setEnabled] = createSignal(!!props.checked);
    createEffect(() => setEnabled(!!props.checked));
    return (
        <div class="optional-fields">
            <label class="checkbox">
                <input
                    type="checkbox"
                    name={props.name}
                    checked={enabled()}
                    onChange={(event) => setEnabled(event.currentTarget.checked)}
                />
                {props.label}
            </label>
            <fieldset
                class="optional-fields__body"
                hidden={!enabled()}
                disabled={!enabled()}
                aria-label={props.label}
            >
                {props.children}
            </fieldset>
        </div>
    );
}

/** Visible form result announced to assistive technology. */
export function FormMessage(props: { error?: string; success?: string }) {
    return (
        <Show when={props.error ?? props.success}>
            <p
                aria-live="polite"
                classList={{
                    "form-error": props.error !== undefined,
                    "form-success": props.error === undefined,
                }}
            >
                {props.error ?? props.success}
            </p>
        </Show>
    );
}

/** Keep editor submission and bottom actions in one native form. */
export function Editor(
    props: JSX.FormHTMLAttributes<HTMLFormElement> & {
        actions?: () => JSX.Element;
    },
) {
    const [local, attributes] = splitProps(props, ["actions", "children", "ref"]);
    let form!: HTMLFormElement;
    let baseline: string | undefined;
    let submitted: string | undefined;
    let hasInteracted = false;
    const isDirty = () => hasInteracted && baseline !== undefined && snapshot(form) !== baseline;
    const leave = useUnsavedChanges(isDirty);

    onMount(() => {
        baseline = snapshot(form);
        // Async options and default values may finish loading before the first edit.
        const begin = () => {
            if (hasInteracted) return;
            baseline = snapshot(form);
            hasInteracted = true;
        };
        const interactions = ["focusin", "pointerdown", "keydown", "beforeinput"];
        interactions.forEach((type) => form.addEventListener(type, begin, true));
        const capture = () => {
            submitted = snapshot(form);
        };
        form.addEventListener("submit", capture, true);
        editors.set(form, {
            isDirty,
            leave,
            saved: () => {
                baseline = submitted ?? snapshot(form);
                submitted = undefined;
            },
            reset: () => {
                baseline = snapshot(form);
                submitted = undefined;
                hasInteracted = false;
            },
        });
        onCleanup(() => {
            form.removeEventListener("submit", capture, true);
            interactions.forEach((type) => form.removeEventListener(type, begin, true));
            editors.delete(form);
        });
    });

    return (
        <form
            {...attributes}
            ref={(element) => {
                form = element;
                if (typeof local.ref === "function") local.ref(element);
            }}
        >
            {local.children}
            {local.actions?.()}
        </form>
    );
}

const editors = new WeakMap<
    HTMLFormElement,
    {
        isDirty: () => boolean;
        leave: () => Promise<boolean>;
        saved: () => void;
        reset: () => void;
    }
>();

/** Mark the submitted values as saved, preserving edits made while saving. */
export function savedEditor(form: HTMLFormElement) {
    editors.get(form)?.saved();
}

/** Accept newly selected record values as the editor's baseline. */
export function resetEditor(form: HTMLFormElement) {
    editors.get(form)?.reset();
}

/** Guard record switches and Back buttons that do not change the route. */
export function leaveEditor(form?: HTMLFormElement | string) {
    const element =
        typeof form === "string"
            ? document.getElementById(form)
            : (form ?? Array.from(document.forms).find((item) => editors.get(item)?.isDirty()));
    return editors.get(element as HTMLFormElement)?.leave() ?? Promise.resolve(true);
}

/** Compare values, including dynamic rows and disabled fields, rather than keystrokes. */
function snapshot(form: HTMLFormElement) {
    return JSON.stringify(
        Array.from(form.querySelectorAll("input, textarea, select"))
            .map((element) => {
                const field = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
                if (field instanceof HTMLInputElement) {
                    if (["submit", "button", "reset", "file"].includes(field.type)) return null;
                    if (field.type === "search" && !field.name) return null;
                    return [field.name, field.type, field.value, field.checked];
                }
                if (field instanceof HTMLSelectElement) {
                    return [
                        field.name,
                        Array.from(field.selectedOptions, (option) => option.value),
                    ];
                }
                return [field.name, field.value];
            })
            .filter((field) => field !== null),
    );
}
