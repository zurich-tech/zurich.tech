import { createResource, createSignal } from "solid-js";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { memberClient } from "../auth/convex";
import { useConfirmation } from "../components/dialog";
import { errorMessage } from "../components/errors";

/** Confirm the current unsent follow-up audience before a manual send. */
export function FollowUp(props: { eventId: Id<"events"> }) {
    const confirm = useConfirmation();
    const [preview, { refetch }] = createResource(
        () => props.eventId,
        async (eventId) => (await memberClient()).query(api.mail.followup.preview, { eventId }),
    );
    const [pending, setPending] = createSignal(false);
    const [message, setMessage] = createSignal("");
    async function send() {
        setPending(true);
        setMessage("");
        try {
            const client = await memberClient();
            const latest = await client.query(api.mail.followup.preview, {
                eventId: props.eventId,
            });
            if (!latest.emails) throw new Error("No eligible recipients.");
            if (
                !(await confirm({
                    title: "Send follow-up",
                    subject: latest.title,
                    description: "Send a thank-you email with feedback links when enabled.",
                    action: "Send follow-up",
                    emails: latest.emails,
                }))
            )
                return;
            await client.mutation(api.mail.followup.send, {
                eventId: props.eventId,
                receipt: latest.receipt,
            });
            setMessage("Follow-up queued");
            await refetch();
        } catch (error) {
            setMessage(errorMessage(error, "Could not send follow-up."));
        } finally {
            setPending(false);
        }
    }
    return (
        <div class="grid gap-2">
            <button
                type="button"
                class="button button--primary"
                disabled={pending() || !preview()?.emails}
                onClick={send}
            >
                Send follow-up
            </button>
            <p class="text-soft">
                {preview.error
                    ? "Could not load recipients"
                    : `${preview()?.emails ?? 0} eligible recipients`}
            </p>
            <span role="status">{message()}</span>
        </div>
    );
}
