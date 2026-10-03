import type { MutationCtx } from "../_generated/server";
import type { Content, Recipient } from "./model";
import { siteOrigin } from "../auth/environment";
import { escapeHtml, paragraph } from "./layout";
import { attendanceCopy, welcome, resourcesPlaceholder } from "./attendance";
import { ensureToken } from "../events/checkin";
import { profileInvitation, profilePlaceholder, type ProfilePrompt } from "./involvement";

/** Code-owned URL placeholders; campaign authors never edit template markup. */
export const links = {
    unsubscribe: "https://mail.invalid/unsubscribe",
    registration: "https://mail.invalid/registration",
    pass: "https://mail.invalid/pass",
};

/** Materialise private links once, retaining rendered content across retries. */
export async function personalize(ctx: MutationCtx, content: Content, id: Recipient) {
    const row = await ctx.db.get(id);
    if (!row) return null;
    const registration = "eventId" in row ? row : null;
    let subscription =
        "eventId" in row
            ? await ctx.db
                  .query("subscriptions")
                  .withIndex("by_email", (q) => q.eq("email", row.email))
                  .unique()
            : row;

    // make follow-up opt-out links available without subscribing anyone to marketing
    if (content.text.includes(links.unsubscribe) && !subscription?.token) {
        const token = crypto.randomUUID() + crypto.randomUUID();
        if (subscription) await ctx.db.patch(subscription._id, { token });
        else {
            const subscriptionId = await ctx.db.insert("subscriptions", {
                email: row.email,
                status: "unsubscribed",
                weekly: false,
                announcements: false,
                followUps: true,
                token,
                source: "registration",
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
            subscription = await ctx.db.get(subscriptionId);
        }
        if (subscription) subscription = { ...subscription, token };
    }
    const replacements: [string, string][] = [
        [
            links.unsubscribe,
            `${siteOrigin()}/unsubscribe?token=${encodeURIComponent(subscription?.token ?? "")}`,
        ],
        [
            links.registration,
            registration?.token
                ? `${siteOrigin()}/registration?token=${encodeURIComponent(registration.token)}`
                : `${siteOrigin()}/settings`,
        ],
    ];
    if (content.html?.includes(links.pass) && registration)
        replacements.push([
            links.pass,
            `${process.env.CONVEX_SITE_URL}/passes/qr?token=${encodeURIComponent(await ensureToken(ctx, registration))}`,
        ]);

    // escape only substituted URLs; the shared templates already escape user text
    let text = content.text;
    let html = content.html;

    // resolve identity once for profile prompts and attendance references
    const needsIdentity =
        !!content.attendance ||
        text.includes(profilePlaceholder.text) ||
        !!html?.includes(profilePlaceholder.html);
    const email =
        row.memberId || !needsIdentity
            ? null
            : await ctx.db
                  .query("emails")
                  .withIndex("by_email", (q) => q.eq("email", row.email))
                  .unique();
    const memberId = row.memberId ?? (email?.verifiedAt !== undefined ? email.memberId : undefined);

    if (content.attendance) {
        const copy = await attendanceCopy(ctx, content.attendance, row.email, memberId);
        if (content.attendance.kind === "invitation") {
            text = text.replace(welcome, () => copy.text);
            html = html?.replace(paragraph(welcome), () => copy.html);
        } else {
            text = text.replaceAll(resourcesPlaceholder.text, () => copy.text);
            html = html?.replaceAll(resourcesPlaceholder.html, () => copy.html);
        }
    }

    // resolve profile invitations only for templates that request them
    if (text.includes(profilePlaceholder.text) || html?.includes(profilePlaceholder.html)) {
        const member = memberId ? await ctx.db.get(memberId) : null;
        const account = memberId
            ? await ctx.db
                  .query("accounts")
                  .withIndex("by_member", (q) => q.eq("memberId", memberId))
                  .unique()
            : null;
        const prompt: ProfilePrompt =
            (member && ["blocked", "deleted", "paused"].includes(member.status)) ||
            account?.status === "disabled"
                ? "none"
                : !account
                  ? "create"
                  : member?.headline?.trim() || member?.bio?.trim() || member?.affiliations?.length
                    ? "none"
                    : "complete";
        const invitation = profileInvitation(prompt);
        text = text.replaceAll(profilePlaceholder.text, invitation.text);
        html = html?.replaceAll(profilePlaceholder.html, invitation.html);
    }

    for (const [placeholder, value] of replacements) {
        text = text.replaceAll(placeholder, value);
        html = html?.replaceAll(placeholder, escapeHtml(value));
    }
    return {
        ...content,
        text,
        html,
        to: row.email,
        subscriptionId: registration ? undefined : subscription?._id,
        registrationId: registration?._id,
        unsubscribeToken: subscription?.token,
    };
}
