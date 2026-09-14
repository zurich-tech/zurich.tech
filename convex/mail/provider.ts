import { requireRecipient } from "./policy";

/** Require configured delivery before accepting an email-dependent action. */
export function requireMail() {
    if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
        throw new Error("We cannot send your email. Please contact the team.");
}

/** RFC 8058 headers point to a token-authenticated POST endpoint. */
export function unsubscribeHeaders(token?: string) {
    if (!token) return undefined;
    const origin = process.env.CONVEX_SITE_URL;
    if (!origin) throw new Error("Email unsubscribe endpoint is not configured.");
    return {
        "List-Unsubscribe": `<${origin}/mail/unsubscribe?token=${encodeURIComponent(token)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
}

/** Send transactional mail without retaining short-lived sign-in codes in the delivery queue. */
export async function send(message: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    key: string;
    unsubscribeToken?: string;
}) {
    requireMail();

    // enforce the configured recipient restriction
    requireRecipient(message.to);

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": message.key,
        },
        body: JSON.stringify({
            from: process.env.MAIL_FROM,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
            headers: unsubscribeHeaders(message.unsubscribeToken),
        }),
    });
    // avoid logging response bodies that may contain message contents
    if (!response.ok) throw new Error(`Email provider returned ${response.status}.`);
    const result = (await response.json()) as { id: string };
    if (!result.id) throw new Error("Email provider returned no delivery identifier.");
    return result;
}
