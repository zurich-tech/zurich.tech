import type { Confirm } from "../components/dialog";
import type { FunctionArgs } from "convex/server";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";

/** Confirm an event transition against freshly calculated email counts. */
export async function confirmEvent(
    args: FunctionArgs<typeof api.events.actions.preview>,
    title: string,
    confirm: Confirm,
) {
    const preview = await (await memberClient()).query(api.events.actions.preview, args);
    if (preview.permissionError) throw new Error(preview.permissionError);
    const effects =
        args.action === "unpublish"
            ? "This hides the event and closes registration. Existing registrations are kept."
            : args.action === "cancel"
              ? "This cancels the event and closes registration."
              : args.action === "confirm"
                ? "This confirms the event even if its requirements are unmet."
                : args.action === "approve"
                  ? "This records team approval. Other requirements still apply."
                  : preview.visibility === "unlisted"
                    ? "This publishes an unlisted event. Anyone with the link can view and register; it stays out of listings and promotional emails."
                    : preview.visibilityChanged
                      ? "This makes the event publicly listed. Anyone can find it on the website."
                      : "This publishes your changes.";
    const accepted = await confirm({
        title,
        subject: preview.title,
        action: args.action === "cancel" ? "Cancel" : title,
        description: effects,
        isDestructive: args.action === "cancel" || args.action === "unpublish",
        emails: preview.emails,
        recipients: preview.recipients,
        details: [
            preview.followUp
                ? `Follow-up scheduled ${preview.followUp.delayHours} hours after the event, for ${preview.followUp.isAttendanceRequired ? "checked-in attendees" : "confirmed registrants"}. ${preview.followUp.currentRegistrations} currently confirmed; the final email count depends on eligibility at delivery.`
                : "",
            preview.announcements ? `${preview.announcements} subscriber announcements.` : "",
            preview.updates
                ? `${preview.updates} registration updates.${preview.changes.length ? ` Changed: ${preview.changes.join(", ").toLowerCase()}.` : ""}`
                : "",
            preview.promotions ? `${preview.promotions} waitlist confirmations.` : "",
        ]
            .filter(Boolean)
            .join(" "),
    });

    return accepted ? preview.receipt : undefined;
}
