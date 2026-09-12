import "./participation.css";
import type { Doc } from "../../convex/_generated/dataModel";

/** Configure independent attendance, feedback and follow-up features. */
export function ParticipationFields(props: { draft?: Doc<"submissions"> }) {
    return (
        <>
            <fieldset>
                <legend>Attendance</legend>
                <label>
                    Venue capacity
                    <input
                        type="number"
                        name="venueCapacity"
                        min="1"
                        step="1"
                        value={props.draft?.venueCapacity ?? ""}
                    />
                    <span>Maximum people admitted. Team only.</span>
                </label>
                <label class="checkbox">
                    <input
                        type="checkbox"
                        name="checkIn"
                        checked={props.draft?.checkIn?.isEnabled ?? false}
                    />
                    QR check-in
                </label>
            </fieldset>
            <fieldset>
                <legend>Feedback</legend>
                <label class="checkbox">
                    <input
                        type="checkbox"
                        name="eventFeedback"
                        checked={props.draft?.feedback?.isEventEnabled ?? false}
                    />
                    Event feedback
                </label>
                <label class="checkbox">
                    <input
                        type="checkbox"
                        name="speakerFeedback"
                        checked={props.draft?.feedback?.isSpeakerEnabled ?? false}
                    />
                    Speaker feedback
                </label>
            </fieldset>
            <fieldset>
                <legend>Follow-up</legend>
                <label class="checkbox">
                    <input
                        type="checkbox"
                        name="followUp"
                        checked={props.draft?.followUp?.isEnabled ?? false}
                    />
                    Send a thank-you email
                </label>
                <label>
                    Hours after the event
                    <input
                        type="number"
                        name="followUpDelay"
                        min="1"
                        max="168"
                        value={props.draft?.followUp?.delayHours ?? 24}
                    />
                </label>
            </fieldset>
        </>
    );
}
