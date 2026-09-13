import {
    createContext,
    useContext,
    createEffect,
    createSignal,
    createUniqueId,
    onCleanup,
    onMount,
    Show,
    type JSX,
} from "solid-js";
import { useLocation } from "@solidjs/router";
import "./dialog.css";

/** Accessible modal with native focus containment and our own presentation. */
export function Dialog(props: {
    isOpen: boolean;
    title: string;
    children: JSX.Element;
    actions: JSX.Element;
    onClose: () => void;
    returnFocus?: HTMLElement;
}) {
    let element!: HTMLDialogElement;
    const id = createUniqueId();
    let restoreOverflow: string | undefined;
    let previousFocus: HTMLElement | null = null;
    let focusFrame: number | undefined;

    // keep focus inside the modal and prevent the underlying page from scrolling
    onMount(() =>
        createEffect(() => {
            if (props.isOpen && !element.open) {
                previousFocus =
                    props.returnFocus ??
                    (document.activeElement instanceof HTMLElement ? document.activeElement : null);
                restoreOverflow = document.body.style.overflow;
                document.body.style.overflow = "hidden";
                element.showModal();
            } else if (!props.isOpen && element.open) {
                element.close();
                document.body.style.overflow = restoreOverflow ?? "";
                restoreOverflow = undefined;
                focusFrame = requestAnimationFrame(() => {
                    if (!element.open && previousFocus?.isConnected) previousFocus.focus();
                });
            }
        }),
    );
    onCleanup(() => {
        if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
        if (restoreOverflow !== undefined) document.body.style.overflow = restoreOverflow;
    });

    return (
        <dialog
            ref={element}
            class="dialog"
            aria-labelledby={id}
            onCancel={(event) => {
                event.preventDefault();
                props.onClose();
            }}
        >
            <header class="dialog-heading">
                <h2 id={id}>{props.title}</h2>
            </header>
            <div class="dialog-body">{props.children}</div>
            <footer class="dialog-actions">{props.actions}</footer>
        </dialog>
    );
}

/** A decision and its known consequences. */
export type Confirmation = {
    title: string;
    description: string;
    subject?: string;
    action: string;
    dismiss?: string;
    isDestructive?: boolean;
    emails?: number;
    recipients?: number;
    audience?: string;
    details?: string;
};

/** Request an explicit decision without executing the operation. */
export type Confirm = (options: Confirmation) => Promise<boolean>;
const ConfirmationContext = createContext<Confirm>();

/** Read the confirmation service owned by the current application. */
export function useConfirmation(): Confirm {
    const confirm = useContext(ConfirmationContext);
    if (!confirm) throw new Error("ConfirmationProvider is required.");
    return confirm;
}

/** Host queued confirmations above every route and cancel them on navigation. */
export function ConfirmationProvider(props: { children: JSX.Element }) {
    const location = useLocation();
    let dismissButton!: HTMLButtonElement;
    const [current, setCurrent] = createSignal<Confirmation>();
    const [origin, setOrigin] = createSignal<HTMLElement>();
    let lastFocused: HTMLElement | undefined;
    const queue: {
        options: Confirmation;
        resolve: (answer: boolean) => void;
        origin?: HTMLElement;
    }[] = [];

    // retain the initiating control even when loading the preview temporarily disables it
    onMount(() => {
        const remember = (event: FocusEvent) => {
            if (
                event.target instanceof HTMLElement &&
                event.target !== document.body &&
                !event.target.closest("dialog")
            )
                lastFocused = event.target;
        };
        document.addEventListener("focusin", remember);
        onCleanup(() => document.removeEventListener("focusin", remember));
    });

    /** Resolve one decision before presenting the next queued request. */
    function finish(answer: boolean) {
        queue.shift()?.resolve(answer);
        setOrigin(queue[0]?.origin);
        setCurrent(queue[0]?.options);
        if (queue.length) dismissButton.focus();
    }

    /** Prevent a pending operation from completing after its page has been left. */
    function dismissAll() {
        for (const item of queue.splice(0)) item.resolve(false);
        setCurrent(undefined);
    }

    const confirm: Confirm = (options) =>
        new Promise((resolve) => {
            queue.push({ options, resolve, origin: lastFocused });
            if (queue.length === 1) {
                setOrigin(lastFocused);
                setCurrent(options);
            }
        });
    createEffect(() => {
        void location.pathname;
        void location.search;
        dismissAll();
    });
    onCleanup(dismissAll);

    return (
        <ConfirmationContext.Provider value={confirm}>
            {props.children}
            <Dialog
                isOpen={!!current()}
                returnFocus={origin()}
                title={current()?.title ?? "Confirm"}
                onClose={() => finish(false)}
                actions={
                    <>
                        <button
                            type="button"
                            class="button"
                            autofocus
                            ref={dismissButton}
                            onClick={() => finish(false)}
                        >
                            {current()?.dismiss ?? "Dismiss"}
                        </button>
                        <button
                            type="button"
                            class="button button--primary"
                            classList={{ "dialog-danger": !!current()?.isDestructive }}
                            onClick={() => finish(true)}
                        >
                            {current()?.action}
                        </button>
                    </>
                }
            >
                <Show when={current()?.subject}>
                    <strong>{current()?.subject}</strong>
                </Show>
                <p>{current()?.description}</p>
                <Show when={current()?.emails !== undefined}>
                    <div
                        class="dialog-mail"
                        classList={{ "has-emails": (current()?.emails ?? 0) > 0 }}
                        role="status"
                    >
                        <strong>{current()?.emails?.toLocaleString("en-CH")}</strong>
                        <div>
                            <b>
                                {current()?.emails === 1
                                    ? "email will be sent"
                                    : "emails will be sent"}
                            </b>
                            <Show when={(current()?.emails ?? 0) > 0}>
                                <span>
                                    <Show
                                        when={
                                            current()?.recipients !== current()?.emails ||
                                            !current()?.audience
                                        }
                                    >
                                        {current()?.recipients?.toLocaleString("en-CH")}{" "}
                                    </Show>
                                    {current()?.audience ??
                                        (current()?.recipients === 1 ? "recipient" : "recipients")}
                                </span>
                            </Show>
                        </div>
                    </div>
                </Show>
                <Show when={current()?.details}>
                    <p class="dialog-details">{current()?.details}</p>
                </Show>
            </Dialog>
        </ConfirmationContext.Provider>
    );
}
