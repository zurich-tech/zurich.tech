import { Alert } from "./alert";
import { Edits } from "./edits";
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
    // test restrictions are warnings, while failures and successful actions retain their own tone
    const isTestMode = () => props.error?.startsWith("Test mode:") ?? false;
    return (
        <Show when={props.error ?? props.success}>
            <Alert
                tone={isTestMode() ? "warning" : props.error !== undefined ? "error" : "success"}
                title={
                    isTestMode()
                        ? "Test mode"
                        : props.error !== undefined
                          ? "Unable to continue"
                          : undefined
                }
            >
                {isTestMode()
                    ? props.error!.slice("Test mode:".length).trim()
                    : (props.error ?? props.success)}
            </Alert>
        </Show>
    );
}

/** Keep editor submission and bottom actions in one native form. */
export function Editor(
    props: Omit<JSX.FormHTMLAttributes<HTMLFormElement>, "onSubmit"> & {
        onSubmit?: (event: SubmitEvent) => void | Promise<void>;
        actions?: () => JSX.Element;
    },
) {
    const [local, attributes] = splitProps(props, ["actions", "children", "ref", "onSubmit"]);
    let form!: HTMLFormElement;
    const edits = new Edits();
    const [isSaving, setSaving] = createSignal(false);
    const isDirty = () => edits.isDirty(snapshot(form));
    const leave = useUnsavedChanges(isDirty);

    onMount(() => {
        edits.reset(snapshot(form));
        // capture defaults before edits and track interactions while a save is in flight
        const begin = () => {
            if (!isSaving()) edits.interact(() => snapshot(form));
        };
        const interactions = [
            "focusin",
            "pointerdown",
            "keydown",
            "beforeinput",
            "input",
            "change",
            "click",
        ];
        interactions.forEach((type) => form.addEventListener(type, begin, true));
        editors.set(form, {
            isDirty,
            leave,
            saved: () => edits.saved(snapshot(form)),
            reset: () => edits.reset(snapshot(form)),
        });
        onCleanup(() => {
            interactions.forEach((type) => form.removeEventListener(type, begin, true));
            editors.delete(form);
        });
    });

    return (
        <form
            {...attributes}
            inert={isSaving() || attributes.inert}
            aria-busy={isSaving()}
            onSubmit={async (event) => {
                // keep one submitted version stable until saving and refreshing have finished
                event.preventDefault();
                if (isSaving() || attributes.inert) return;
                edits.submit(snapshot(form));
                setSaving(true);
                try {
                    await local.onSubmit?.(event);
                } finally {
                    setSaving(false);
                }
            }}
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
