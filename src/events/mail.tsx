import { Campaigns } from "../mail/campaigns";
import { useAccess } from "../auth/edit";
import { FollowUp } from "./followup";
import { useConfirmation } from "../components/dialog";
import { createResource, createSignal, Show, startTransition } from "solid-js";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { Card } from "../components/card";
import { FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";
import "../mail/mail.css";

/** Preview and explicitly send event mail from the team editor. */
export function EventMail(props: { eventId: Id<"events"> }) {
    const access = useAccess();
    const confirm = useConfirmation();
    const [preview, { refetch }] = createResource(
        () => props.eventId,
        async (eventId) => (await memberClient()).query(api.events.mail.preview, { eventId }),
    );
    const [isPending, setIsPending] = createSignal(false);
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();

    /** Recount recipients immediately before asking for confirmation. */
    async function send() {
        setIsPending(true);
        setError(undefined);
        setSuccess(undefined);
        try {
            const client = await memberClient();
            const result = await client.query(api.events.mail.preview, {
                eventId: props.eventId,
            });
            const latest = result.reminder;
            if (latest.reason) throw new Error(latest.reason);
            if (!latest.recipients) throw new Error("No eligible recipients.");
            if (
                !(await confirm({
                    title: "Send attendee reminder",
                    action: "Send reminder",
                    description: "Send the published event by email.",
                    subject: result.title,
                    emails: latest.recipients,
                    recipients: latest.recipients,
                    audience: "current registrants",
                }))
            )
                return;
            await client.mutation(api.events.mail.send, {
                eventId: props.eventId,
                kind: "reminder",
                receipt: latest.receipt,
            });
            setSuccess("Reminder queued.");
            await startTransition(refetch);
        } catch (caught) {
            setError(errorMessage(caught, "Could not send event mail."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <Card
                title={preview.latest ? `${preview.latest.title} · Email` : "Event email"}
                toolbar={
                    <Show when={preview.latest}>
                        {(event) => (
                            <a class="action-link" href={`/events/${event().slug}`}>
                                Event
                            </a>
                        )}
                    </Show>
                }
            >
                <div class="mail-actions">
                    <div class="mail-control">
                        <div>
                            <strong>Attendee reminder</strong>
                            <p class="text-soft">
                                Automatic within 24 hours of the event. Manual sends share the same
                                recipient checks.
                            </p>
                            <p>
                                {preview.error
                                    ? "Could not load recipients."
                                    : (preview.latest?.reminder.reason ??
                                      (preview.latest
                                          ? `${preview.latest.reminder.recipients.toLocaleString("en-CH")} current registrants`
                                          : "Loading recipients…"))}
                            </p>
                        </div>
                        <button
                            type="button"
                            class="button"
                            disabled={
                                isPending() ||
                                !preview.latest?.reminder.recipients ||
                                !!preview.latest?.reminder.reason ||
                                !access.current()?.canSendMail
                            }
                            title={
                                !access.current()?.canSendMail
                                    ? "Email sending permission required"
                                    : undefined
                            }
                            onClick={() => void send()}
                        >
                            Send reminder
                        </button>
                    </div>
                    <Show when={preview.error}>
                        <button type="button" class="button" onClick={() => void refetch()}>
                            Retry recipients
                        </button>
                    </Show>
                    <FollowUp eventId={props.eventId} />
                </div>
                <FormMessage error={error()} success={success()} />
            </Card>
            <Campaigns eventId={props.eventId} />
        </>
    );
}
