import "./participation.css";
import { Show, type ComponentProps } from "solid-js";
import { Card } from "../components/card";
import { FormSection, OptionalFields } from "../components/form";
import { RegistrationFields } from "./event-editor";
import { ConfirmationFields } from "./confirmation";

/** Configure the event lifecycle without coupling its independent policies. */
export function EventOptions(
    props: ComponentProps<typeof RegistrationFields> & { confirmedAt?: number },
) {
    return (
        <Card title="Event settings" class="event-options">
            <FormSection title="Before the event">
                <RegistrationFields {...props} />
                <ConfirmationFields
                    confirmation={props.draft?.confirmation}
                    startsAt={props.draft?.startsAt}
                    confirmedAt={props.confirmedAt}
                    hasNativeRegistration={props.kind === "native"}
                />
            </FormSection>
            <FormSection title="At the event">
                <label>
                    Venue capacity
                    <input
                        type="number"
                        name="venueCapacity"
                        min="1"
                        step="1"
                        value={props.draft?.venueCapacity ?? ""}
                    />
                    <span>People admitted. Visible to organisers only.</span>
                </label>
                <Show when={props.kind === "native"}>
                    <label class="checkbox">
                        <input
                            type="checkbox"
                            name="checkIn"
                            checked={props.draft?.checkIn?.isEnabled ?? false}
                        />
                        QR check-in
                    </label>
                </Show>
            </FormSection>
            <Show when={props.kind === "native"}>
                <FormSection title="After the event">
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
                    <OptionalFields
                        name="followUp"
                        label="Send a thank-you email"
                        checked={props.draft?.followUp?.isEnabled}
                    >
                        <label>
                            Send after (hours)
                            <input
                                type="number"
                                name="followUpDelay"
                                min="1"
                                max="168"
                                value={props.draft?.followUp?.delayHours ?? 24}
                            />
                        </label>
                    </OptionalFields>
                </FormSection>
            </Show>
        </Card>
    );
}
