import { createSignal, startTransition } from "solid-js";
import { api } from "../../convex/_generated/api";
import { publicClient } from "../auth/convex";
import { useConfirmation } from "../components/dialog";
import { errorMessage } from "../components/errors";

/** Confirm a cancellation and refresh its registration without replacing the page. */
export function useCancellation(token: () => string, onCancelled: () => void | Promise<unknown>) {
    const confirm = useConfirmation();
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    /** Release the attendee's seat after explicit cancellation. */
    async function cancel() {
        setIsPending(true);
        setError(undefined);
        try {
            const preview = await publicClient().query(
                api.events.registrations.previewCancellation,
                { token: token() },
            );
            if (
                !(await confirm({
                    title: "Cancel registration",
                    action: "Cancel",
                    description:
                        "Release your place. It may be offered to someone on the waitlist.",
                    isDestructive: true,
                    emails: preview.emails,
                    recipients: preview.recipients,
                }))
            )
                return;
            await publicClient().mutation(api.events.registrations.cancel, {
                token: token(),
                receipt: preview.receipt,
            });
            await startTransition(onCancelled);
        } catch (caught) {
            setError(errorMessage(caught, "Could not cancel."));
        } finally {
            setIsPending(false);
        }
    }

    return { cancel, error, isPending };
}
