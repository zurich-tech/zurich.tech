import { useSearchParams } from "@solidjs/router";
import { Show } from "solid-js";
import { Page } from "../page";
import { Seo } from "../seo";
import { useAccess } from "../../auth/edit";
import { EventMail } from "../../events/mail";
import type { Id } from "../../../convex/_generated/dataModel";

/** Open an event's email controls and campaign history. */
export default function Route() {
    const [params] = useSearchParams();
    const access = useAccess();
    const eventId = () =>
        typeof params.event === "string" ? (params.event as Id<"events">) : undefined;

    return (
        <>
            <Seo title="Event email" description="Event invitations and delivery history." />
            <Page class="publication">
                <Show
                    when={eventId() && access.canEvent(eventId(), "organiser")}
                    fallback={<p>Sign in with event organiser access to manage email.</p>}
                >
                    <EventMail eventId={eventId()!} />
                </Show>
            </Page>
        </>
    );
}
