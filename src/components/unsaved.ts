import { onCleanup, onMount } from "solid-js";
import { useBeforeLeave } from "@solidjs/router";
import { useConfirmation } from "./dialog";

/** Protect edited content during route changes and browser navigation. */
export function useUnsavedChanges(isDirty: () => boolean) {
    const confirm = useConfirmation();
    let isConfirming = false;

    /** Ask once before abandoning any unsaved content on this page. */
    async function leave() {
        if (!isDirty()) return true;
        if (isConfirming) return false;
        isConfirming = true;
        try {
            return await confirm({
                title: "Unsaved changes",
                description: "Leave without saving your changes?",
                action: "Discard changes",
                dismiss: "Keep editing",
                isDestructive: true,
            });
        } finally {
            isConfirming = false;
        }
    }

    // Hash links within the same page do not discard an editor.
    useBeforeLeave((event) => {
        if (event.defaultPrevented || !isDirty()) return;
        if (typeof event.to === "string") {
            const destination = new URL(event.to, window.location.href);
            if (
                destination.pathname === event.from.pathname &&
                destination.search === event.from.search
            )
                return;
        }
        event.preventDefault();
        void leave().then((accepted) => accepted && event.retry(true));
    });

    // Browsers require their own dialog when the document is being unloaded.
    onMount(() => {
        const unload = (event: BeforeUnloadEvent) => {
            if (!isDirty()) return;
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", unload);
        onCleanup(() => window.removeEventListener("beforeunload", unload));
    });

    return leave;
}
