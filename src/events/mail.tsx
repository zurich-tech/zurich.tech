import { FollowUp } from "./followup";
import { useConfirmation } from "../components/dialog";
import { createResource, createSignal, For, Show, startTransition } from "solid-js";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { Card } from "../components/card";
import { FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";

/** Preview and explicitly send event mail from the team editor. */
export function EventMail(props: { eventId: Id<"events"> }) {
    const confirm = useConfirmation();
    const [preview, { refetch }] = createResource(
        () => props.eventId,
        async (eventId) => (await memberClient()).query(api.events.mail.preview, { eventId }),
    );
    const [isPending, setIsPending] = createSignal(false);
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();

    /** Recount recipients immediately before asking for confirmation. */
    async function send(kind: "announcement" | "reminder") {
        setIsPending(true);
        setError(undefined);
        setSuccess(undefined);
        try {
            const client = await memberClient();
            const result = await client.query(api.events.mail.preview, { eventId: props.eventId });
            const latest = result[kind];
            if (latest.reason) throw new Error(latest.reason);
            if (!latest.recipients) throw new Error("No eligible recipients.");
            const audience = kind === "announcement" ? "subscribers" : "registered participants";
            if (
                !(await confirm({
                    title: kind === "announcement" ? "Announce event" : "Send reminder",
                    action: kind === "announcement" ? "Send announcement" : "Send reminder",
                    description: "Send the published event by email.",
                    subject: result.title,
                    emails: latest.recipients,
                    recipients: latest.recipients,
                    audience,
                }))
            )
                return;
            await client.mutation(api.events.mail.send, {
                eventId: props.eventId,
                kind,
                receipt: latest.receipt,
            });
            setSuccess(kind === "announcement" ? "Announcement queued." : "Reminder queued.");
            await startTransition(refetch);
        } catch (caught) {
            setError(errorMessage(caught, "Could not send event mail."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Card title="Email">
            <div class="grid gap-4">
                <For each={["announcement", "reminder"] as const}>
                    {(kind) => {
                        const item = () => preview.latest?.[kind];
                        return (
                            <div class="grid gap-2">
                                <button
                                    type="button"
                                    class="button button--primary"
                                    disabled={
                                        isPending() || !item()?.recipients || !!item()?.reason
                                    }
                                    onClick={() => void send(kind)}
                                >
                                    {kind === "announcement" ? "Announce event" : "Send reminder"}
                                </button>
                                <p class="text-soft" style={{ margin: "0" }}>
                                    {item()?.reason ??
                                        (item()
                                            ? `${item()!.recipients.toLocaleString("en-CH")} ${kind === "announcement" ? "subscribers" : "registered participants"}`
                                            : "Loading recipients…")}
                                </p>
                            </div>
                        );
                    }}
                </For>
                <Show when={preview.error}>
                    <button type="button" class="button" onClick={() => void refetch()}>
                        Retry recipients
                    </button>
                </Show>
            </div>
            <FollowUp eventId={props.eventId} />
            <FormMessage error={error()} success={success()} />
        </Card>
    );
}
