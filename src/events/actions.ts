import type { FunctionArgs } from "convex/server";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";

/** Confirm an event transition against freshly calculated email counts. */
export async function confirmEvent(
    args: FunctionArgs<typeof api.events.actions.preview>,
    title: string,
) {
    const preview = await (await memberClient()).query(api.events.actions.preview, args);
    const effects =
        args.action === "unpublish"
            ? "This hides the event and closes registration. Existing registrations are kept."
            : args.action === "cancel"
              ? "This cancels the event and closes registration."
              : "This publishes your changes.";
    const mail = preview.emails
        ? `This will email ${preview.recipients.toLocaleString("en-CH")} recipient${preview.recipients === 1 ? "" : "s"}${preview.emails > preview.recipients ? ` (${preview.emails} emails)` : ""}.${preview.promotions ? ` ${preview.promotions} waitlist confirmation${preview.promotions === 1 ? "" : "s"} included.` : ""}`
        : "No emails will be sent.";

    return window.confirm(`${title}?\n\n${effects}\n\n${mail}`) ? preview.receipt : undefined;
}
