import { VenueCard } from "../../events/venue";
import { Pass } from "../../events/checkin";
import { FeedbackForm } from "../../events/feedback";
import { useCancellation } from "../../events/cancellation";
import { RegistrationStatus } from "../../events/status";
import { useConfirmationRefresh } from "../../events/queries";
import { isTentative } from "../../../convex/events/conditions";
import { timeZone } from "../site";

import { Card } from "../../components/card";
import { useSearchParams } from "@solidjs/router";
import { createResource, Show } from "solid-js";
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
    const [ticket, { refetch }] = createResource(
        () => (typeof params.token === "string" ? params.token : undefined),
        async (token) => await publicClient().query(api.events.registrations.get, { token }),
    );

    const { cancel, error, isPending } = useCancellation(
        () => String(params.token),
        async () => {
            await refetch();
        },
    );

    useConfirmationRefresh(
        () =>
            !!ticket.latest &&
            ticket.latest.eventStatus === "scheduled" &&
            isTentative(ticket.latest),
        refetch,
    );

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
                                <VenueCard venue={item().venue} />
                                <FeedbackForm token={String(params.token)} />
                            </div>
                            <div class="editor-column">
                                <Card title="Registration">
                                    <DetailList>
                                        <DetailRow
                                            label="Status"
                                            value={
                                                <RegistrationStatus
                                                    status={item().status}
                                                    isCancelled={item().eventStatus === "cancelled"}
                                                    isTentative={isTentative(item())}
                                                />
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
                                            {isPending() ? "Cancelling…" : "Cancel"}
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
