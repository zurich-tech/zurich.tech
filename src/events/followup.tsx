import { createResource, createSignal } from "solid-js";
import { useAccess } from "../auth/edit";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { memberClient } from "../auth/convex";
import { useConfirmation } from "../components/dialog";
import { FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";

/** Confirm the current unsent follow-up audience before a manual send. */
export function FollowUp(props: { eventId: Id<"events"> }) {
    const access = useAccess();
    const confirm = useConfirmation();
    const [preview, { refetch }] = createResource(
        () => props.eventId,
        async (eventId) => (await memberClient()).query(api.mail.followup.preview, { eventId }),
    );
    const [pending, setPending] = createSignal(false);
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();
    /** Confirm eligible recipients and queue the event follow-up. */
    async function send() {
        setPending(true);
        setError(undefined);
        setSuccess(undefined);
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
            setSuccess("Follow-up queued.");
            await refetch();
        } catch (error) {
            setError(errorMessage(error, "Could not send follow-up."));
        } finally {
            setPending(false);
        }
    }
    return (
        <div class="mail-followup">
            <div class="mail-control">
                <div>
                    <strong>Follow-up</strong>
                    <p>
                        {preview.error
                            ? "Could not load recipients."
                            : preview()
                              ? `${preview()!.emails.toLocaleString("en-CH")} eligible recipients`
                              : "Loading recipients…"}
                    </p>
                </div>
                <button
                    type="button"
                    class="button"
                    disabled={pending() || !preview()?.emails || !access.current()?.canSendMail}
                    title={
                        !access.current()?.canSendMail
                            ? "Email sending permission required"
                            : undefined
                    }
                    onClick={send}
                >
                    Send follow-up
                </button>
            </div>
            <FormMessage error={error()} success={success()} />
        </div>
    );
}
