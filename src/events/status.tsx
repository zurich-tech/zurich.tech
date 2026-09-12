import { Show } from "solid-js";
import type { Doc } from "../../convex/_generated/dataModel";

/** Present admission separately from whether the event will happen. */
export function RegistrationStatus(props: {
    status: Doc<"registrations">["status"];
    isCancelled?: boolean;
    isTentative?: boolean;
}) {
    return (
        <>
            <span
                class="tag registration-status"
                classList={{ "tag-upcoming": props.status === "going" && !props.isCancelled }}
            >
                {props.isCancelled
                    ? "Event cancelled"
                    : {
                          going: props.isTentative ? "Registered" : "Confirmed",
                          pending: "Pending approval",
                          waitlist: "Waitlisted",
                          declined: "Declined",
                          cancelled: "Cancelled",
                      }[props.status]}
            </span>
            <Show when={props.isTentative && !props.isCancelled}>
                <span class="tag registration-status">Event tentative</span>
            </Show>
        </>
    );
}
