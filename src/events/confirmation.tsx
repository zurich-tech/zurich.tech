import { Card } from "../components/card";
import { Show } from "solid-js";
import { OptionalFields } from "../components/form";
import type { Confirmation } from "../../convex/events/fields";
import { isTentative } from "../../convex/events/conditions";

/** Edit occurrence requirements independently of attendee admission and publication. */
export function ConfirmationFields(props: {
    confirmation?: Confirmation;
    startsAt?: number;
    confirmedAt?: number;
    hasNativeRegistration?: boolean;
}) {
    return (
        <OptionalFields
            name="isConditional"
            label="Require confirmation before the event"
            checked={!!props.confirmation}
        >
            <Show when={props.confirmedAt}>
                <p class="form-success">Confirmed</p>
            </Show>
            <div classList={{ "form-columns": props.hasNativeRegistration !== false }}>
                <label hidden={props.hasNativeRegistration === false}>
                    Minimum registrations
                    <input
                        type="number"
                        name="minimum"
                        disabled={props.hasNativeRegistration === false}
                        min="1"
                        step="1"
                        placeholder="None"
                        value={props.confirmation?.minimum ?? ""}
                    />
                </label>
                <label>
                    Deadline before start (hours)
                    <input
                        required
                        type="number"
                        name="decisionHours"
                        min="0.25"
                        step="0.25"
                        value={
                            props.confirmation && props.startsAt
                                ? (props.startsAt - props.confirmation.decidesAt) / 3600000
                                : 6
                        }
                    />
                </label>
            </div>
            <label class="checkbox">
                <input
                    type="checkbox"
                    name="isApprovalRequired"
                    checked={props.confirmation?.isApprovalRequired ?? false}
                />
                Require organiser approval
            </label>
            <label>
                Confirm
                <select name="confirmationTiming" value={props.confirmation?.timing ?? "deadline"}>
                    <option value="deadline">At the deadline</option>
                    <option value="immediate">As soon as requirements are met</option>
                </select>
            </label>
            <p class="field-hint">
                Cancel automatically if requirements aren’t met by the deadline.
            </p>
        </OptionalFields>
    );
}

/** Convert the editor's relative deadline to an occurrence's concrete instant. */
export function readConfirmation(fields: FormData, startsAt: number): Confirmation | undefined {
    if (!fields.has("isConditional")) return undefined;
    return {
        minimum: fields.get("minimum") ? Number(fields.get("minimum")) : undefined,
        decidesAt: startsAt - Number(fields.get("decisionHours")) * 3600000,
        isApprovalRequired: fields.has("isApprovalRequired"),
        timing: fields.get("confirmationTiming") === "immediate" ? "immediate" : "deadline",
    };
}

/** Show the promise made to registrants while an occurrence is tentative. */
export function ConfirmationNotice(props: {
    event: {
        confirmation?: Confirmation;
        confirmedAt?: number;
        status?: string;
        rsvpCount?: number;
        isApproved?: boolean;
    };
}) {
    return (
        <Show when={isTentative(props.event) && props.event.status !== "cancelled"}>
            <Card title="Tentative">
                <Show when={props.event.confirmation?.minimum}>
                    <p>
                        <strong>
                            {props.event.rsvpCount ?? 0} of {props.event.confirmation!.minimum}{" "}
                            registered
                        </strong>
                    </p>
                </Show>
                <Show when={props.event.confirmation?.isApprovalRequired}>
                    <p>{props.event.isApproved ? "Team approved" : "Team approval required"}</p>
                </Show>
                <p>
                    Decision by{" "}
                    {new Date(props.event.confirmation!.decidesAt).toLocaleString("en-GB", {
                        timeZone: "Europe/Zurich",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </p>
                <p class="field-hint">
                    We’ll email registered participants when the event is confirmed or cancelled.
                </p>
            </Card>
        </Show>
    );
}
