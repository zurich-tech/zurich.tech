import { timeZone } from "../core/constants";

import { Card } from "../component/card";
import { Arrow } from "../component/arrow";
import { useSearchParams } from "@solidjs/router";
import { createResource, createSignal, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { publicClient } from "../core/convex";
import { Page, PageHeader } from "../component/page";
import { Seo } from "../component/seo";
import { FormMessage } from "../component/form";
import { errorMessage } from "../core/error";

/** Manage one registration using its private email link. */
export default function Route() {
    // load attendance through the private management link
    const [params] = useSearchParams();
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);
    const [ticket, { refetch }] = createResource(
        () => (typeof params.token === "string" ? params.token : undefined),
        async (token) => await publicClient().query(api.registration.ticket, { token }),
    );

    /** Release the attendee's seat after explicit cancellation. */
    async function cancel() {
        setIsPending(true);
        setError(undefined);
        try {
            if (typeof params.token !== "string") throw new Error("Missing registration token.");
            await publicClient().mutation(api.registration.cancel, { token: params.token });
            await refetch();
        } catch (caught) {
            setError(errorMessage(caught, "Could not cancel."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <Seo title="Your registration" description="Manage your private event registration." />
            <Page width="narrow">
                <PageHeader title="Your registration" />
                <Card title="Registration">
                    <div class="confirmation-panel">
                        <Show
                            when={ticket()}
                            fallback={
                                <p>
                                    {ticket.loading
                                        ? "Loading your registration…"
                                        : ticket.error
                                          ? errorMessage(
                                                ticket.error,
                                                "Could not load registration.",
                                            )
                                          : "Open the private link from your registration email."}
                                </p>
                            }
                        >
                            {(item) => (
                                <>
                                    <h2>{item().title}</h2>
                                    <p>
                                        {item().name} ·{" "}
                                        {new Date(item().startsAt).toLocaleString("en-GB", {
                                            timeZone,
                                        })}{" "}
                                        (Zürich time)
                                    </p>
                                    <p class="supporter-note">
                                        {item().eventStatus === "cancelled"
                                            ? "This event has been cancelled."
                                            : {
                                                  going: "You’re confirmed.",
                                                  waitlist: "You’re on the waitlist.",
                                                  pending: "Awaiting organiser approval.",
                                                  declined: "Your application was declined.",
                                                  cancelled: "Your registration is cancelled.",
                                              }[item().status]}
                                    </p>
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
                                            {isPending() ? "Cancelling…" : "Cancel my registration"}
                                        </button>
                                    </Show>
                                    <a class="text-link" href={`/events/${item().slug}`}>
                                        Event details <Arrow direction="external" />
                                    </a>
                                </>
                            )}
                        </Show>
                        <FormMessage error={error()} />
                    </div>
                </Card>
            </Page>
        </>
    );
}
