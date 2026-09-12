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
    // load attendance through the private management link
    const [params] = useSearchParams();
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);
    const [ticket, { refetch }] = createResource(
        () => (typeof params.token === "string" ? params.token : undefined),
        async (token) => await publicClient().query(api.events.registrations.get, { token }),
    );

    /** Release the attendee's seat after explicit cancellation. */
    async function cancel() {
        setIsPending(true);
        setError(undefined);
        try {
            if (typeof params.token !== "string") throw new Error("Missing registration token.");
            await publicClient().mutation(api.events.registrations.cancel, { token: params.token });
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
                        <div class="listing-layout">
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
                            <Card title="Registration">
                                <DetailList>
                                    <DetailRow
                                        label="Status"
                                        value={
                                            <strong>
                                                {item().eventStatus === "cancelled"
                                                    ? "Event cancelled"
                                                    : {
                                                          going: "Confirmed",
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
                                    <button class="button" disabled={isPending()} onClick={cancel}>
                                        {isPending() ? "Cancelling…" : "Cancel registration"}
                                    </button>
                                </Show>
                                <FormMessage error={error()} />
                            </Card>
                        </div>
                    )}
                </Show>
            </Page>
        </>
    );
}
