import { Pass } from "../../events/checkin";
import { FeedbackForm } from "../../events/feedback";
import { useConfirmation } from "../../components/dialog";
import { useConfirmationRefresh } from "../../events/queries";
import { isTentative } from "../../../convex/events/conditions";
import { timeZone } from "../site";

import { Card } from "../../components/card";
import { useSearchParams } from "@solidjs/router";
import { startTransition, createResource, createSignal, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import { publicClient } from "../../auth/convex";
import { Page, DetailList, DetailRow } from "../page";
import { Seo } from "../seo";
import { FormMessage } from "../../components/form";
import { errorMessage } from "../../components/errors";

/** Manage one registration using its private email link. */
export default function Route() {
    const confirm = useConfirmation();
    // load attendance through the private management link
    const [params] = useSearchParams();
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);
    const [ticket, { refetch }] = createResource(
        () => (typeof params.token === "string" ? params.token : undefined),
        async (token) => await publicClient().query(api.events.registrations.get, { token }),
    );

    useConfirmationRefresh(
        () =>
            !!ticket.latest &&
            ticket.latest.eventStatus === "scheduled" &&
            isTentative(ticket.latest),
        refetch,
    );

    /** Release the attendee's seat after explicit cancellation. */
    async function cancel() {
        setIsPending(true);
        setError(undefined);
        try {
            if (typeof params.token !== "string") throw new Error("Missing registration token.");
            const preview = await publicClient().query(
                api.events.registrations.previewCancellation,
                { token: params.token },
            );
            if (
                !(await confirm({
                    title: "Cancel registration",
                    action: "Cancel registration",
                    description:
                        "Release your place. It may be offered to someone on the waitlist.",
                    isDestructive: true,
                    emails: preview.emails,
                    recipients: preview.recipients,
                }))
            )
                return;
            await publicClient().mutation(api.events.registrations.cancel, {
                token: params.token,
                receipt: preview.receipt,
            });
            await startTransition(refetch);
        } catch (caught) {
            setError(errorMessage(caught, "Could not cancel."));
        } finally {
            setIsPending(false);
        }
    }

    // keep link failures inside the recovery card
    const currentTicket = () => (ticket.error ? undefined : ticket());

    return (
        <>
            <Seo
                title={
                    currentTicket()?.title
                        ? `Registration: ${currentTicket()!.title}`
                        : "Registration"
                }
                description="Manage your event registration."
            />
            <Page>
                <Show
                    when={currentTicket()}
                    fallback={
                        <Card title="Registration" heading="h1">
                            <p role="status">
                                {ticket.loading
                                    ? "Loading…"
                                    : ticket.error
                                      ? errorMessage(ticket.error, "Could not load registration.")
                                      : params.token
                                        ? "This link is invalid. Open the latest link from your registration email."
                                        : "Open the link from your registration email."}
                            </p>
                            <a class="button" href="/events">
                                View events
                            </a>
                        </Card>
                    }
                >
                    {(item) => (
                        <div class="listing-layout registration-layout">
                            <div class="editor-column">
                                <Card
                                    title={item().title}
                                    titleHref={`/events/${item().slug}`}
                                    heading="h1"
                                >
                                    <Show when={item().summary}>
                                        <p>{item().summary}</p>
                                    </Show>
                                    <DetailList>
                                        <DetailRow
                                            label="Date"
                                            value={new Date(item().startsAt).toLocaleDateString(
                                                "en-GB",
                                                {
                                                    timeZone,
                                                    day: "numeric",
                                                    month: "long",
                                                    year: "numeric",
                                                },
                                            )}
                                        />
                                        <DetailRow
                                            label="Time"
                                            value={`${new Date(item().startsAt).toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" })} · Zürich time`}
                                        />
                                        <Show when={item().location}>
                                            <DetailRow label="Venue" value={item().location} />
                                        </Show>
                                    </DetailList>
                                </Card>
                                <FeedbackForm token={String(params.token)} />
                            </div>
                            <div class="editor-column">
                                <Card title="Registration">
                                    <DetailList>
                                        <DetailRow
                                            label="Status"
                                            value={
                                                <strong>
                                                    {item().eventStatus === "cancelled"
                                                        ? "Event cancelled"
                                                        : {
                                                              going: isTentative(item())
                                                                  ? "Registered · Event tentative"
                                                                  : "Confirmed",
                                                              waitlist: "Waitlisted",
                                                              pending: "Pending approval",
                                                              declined: "Declined",
                                                              cancelled: "Cancelled",
                                                          }[item().status]}
                                                </strong>
                                            }
                                        />
                                        <DetailRow label="Name" value={item().name} />
                                        <DetailRow label="Email" value={item().email} />
                                    </DetailList>
                                    <Show
                                        when={
                                            item().eventStatus !== "cancelled" &&
                                            item().startsAt > Date.now() &&
                                            item().status !== "cancelled" &&
                                            item().status !== "declined"
                                        }
                                    >
                                        <button
                                            class="button"
                                            disabled={isPending()}
                                            onClick={cancel}
                                        >
                                            {isPending() ? "Cancelling…" : "Cancel registration"}
                                        </button>
                                    </Show>
                                    <FormMessage error={error()} />
                                </Card>
                                <Show
                                    when={
                                        item().status === "going" &&
                                        item().eventStatus !== "cancelled" &&
                                        item().eventStatus !== "draft"
                                    }
                                >
                                    <Pass token={String(params.token)} />
                                </Show>
                            </div>
                        </div>
                    )}
                </Show>
            </Page>
        </>
    );
}
