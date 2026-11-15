import { v, type Infer } from "convex/values";
import type { Category } from "./model";
import type { Doc } from "../_generated/dataModel";

/** Replaced with the recipient's private preferences URL before sending. */
export const preferencesLink = "https://mail.invalid/preferences";

/** Independent optional email choices. */
export const preferences = {
    weekly: v.boolean(),
    announcements: v.boolean(),
    reminders: v.boolean(),
    followUps: v.boolean(),
};
export type Preferences = { [Key in keyof typeof preferences]: boolean };

/** Resolve legacy defaults without restoring a previous opt-out. */
export function readPreferences(subscription: Doc<"subscriptions"> | null): Preferences {
    const isSubscribed = subscription?.status === "subscribed";

    return {
        weekly: isSubscribed && subscription?.weekly !== false,
        announcements: isSubscribed && subscription?.announcements !== false,
        reminders: subscription?.reminders !== false,
        followUps: subscription?.followUps ?? subscription?.status !== "unsubscribed",
    };
}

/** Email groups recipients can stop through a private link. */
export const scope = v.union(
    v.literal("weekly"),
    v.literal("announcement"),
    v.literal("followup"),
    v.literal("reminder"),
    v.literal("all"),
);
export type Scope = Infer<typeof scope>;

/** Select the preference corresponding to this message. */
export function unsubscribeScope(category?: Category): Scope {
    return category === "weekly" ||
        category === "announcement" ||
        category === "followup" ||
        category === "reminder"
        ? category
        : "all";
}

/** Preserve broad opt-outs in previously delivered links without a scope. */
export function parseScope(value: unknown): Scope | undefined {
    if (value === undefined || value === null) return "all";
    if (
        value === "weekly" ||
        value === "announcement" ||
        value === "followup" ||
        value === "reminder" ||
        value === "all"
    )
        return value;

    return undefined;
}
