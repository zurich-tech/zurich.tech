import { layout, paragraph, escapeHtml } from "./layout";
import { tiers } from "../../src/sponsorships/plans";
import type { activeSponsors } from "../sponsorships/organisations";
import { siteOrigin } from "../auth/environment";

/** Raster equivalents of vector sponsor assets for email clients. */
const emailLogos: Record<string, string> = {
    "/sponsors/eth-ai-center.svg": "/sponsors/eth-ai-center.png",
};

/** Public event details included in email. */
type Event = {
    title: string;
    slug: string;
    startsAt: number;
    endsAt?: number;
    location?: string;
    summary?: string;
};

/** Render an event title, local date, venue and optional summary. */
export function eventDetails(event: Event, includeSummary = false) {
    const url = `${siteOrigin()}/events/${event.slug}`;
    const time = eventTime(event.startsAt);
    return `<h2 style="font-size:20px;line-height:1.4;margin:0 0 8px"><a href="${escapeHtml(url)}" style="color:#174ed8;text-decoration:none">${escapeHtml(event.title)}</a></h2><p style="margin:0;color:#526074;font-size:14px">${escapeHtml(time)}${event.location ? `<br>${escapeHtml(event.location)}` : ""}</p>${includeSummary && event.summary ? paragraph(event.summary) : ""}`;
}

/** Registration subjects, headings and explanations. */
export const registrationCopy = {
    going: { title: "Registration confirmed" },
    pending: {
        title: "Registration pending",
        description: "Your registration needs organiser approval.",
    },
    waitlist: {
        title: "Registration waitlisted",
        description: "We’ll email you if your registration is confirmed.",
    },
    declined: { title: "Registration declined" },
    cancelled: { title: "Registration cancelled" },
};

/** Format an event date and time consistently in Zürich. */
export function eventTime(timestamp: number) {
    const date = new Date(timestamp);
    const day = date.toLocaleDateString("en-GB", {
        timeZone: "Europe/Zurich",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
    const time = date.toLocaleTimeString("en-GB", {
        timeZone: "Europe/Zurich",
        hour: "2-digit",
        minute: "2-digit",
    });
    return `${day} · ${time} · Zürich time`;
}

/** Render public event details as plain text. */
export function eventText(event: Event, includeSummary = false) {
    return [
        event.title,
        eventTime(event.startsAt),
        event.location,
        includeSummary ? event.summary : undefined,
        `${siteOrigin()}/events/${event.slug}`,
    ]
        .filter(Boolean)
        .join("\n");
}

/** Describe each changed time or venue with its previous and current value. */
export function eventChanges(previous: Event, current: Event) {
    const changes: string[] = [];
    if (previous.startsAt !== current.startsAt)
        changes.push(`Start: ${eventTime(previous.startsAt)} → ${eventTime(current.startsAt)}`);
    if (previous.endsAt !== current.endsAt)
        changes.push(
            `End: ${previous.endsAt ? eventTime(previous.endsAt) : "Not specified"} → ${current.endsAt ? eventTime(current.endsAt) : "Not specified"}`,
        );
    if (previous.location !== current.location)
        changes.push(
            `Venue: ${previous.location || "Not specified"} → ${current.location || "Not specified"}`,
        );
    return changes.join("\n");
}

/** Render an announcement, reminder or registration update in both email formats. */
export function eventEmail(
    event: Event,
    title: string,
    options: {
        subject?: string;
        description?: string;
        summary?: boolean;
        manageUrl?: string;
        unsubscribeUrl?: string;
    } = {},
) {
    const links = [{ label: "Notifications", url: `${siteOrigin()}/settings` }];
    if (options.unsubscribeUrl) links.push({ label: "Unsubscribe", url: options.unsubscribeUrl });
    const action = options.manageUrl
        ? { label: "Manage registration", url: options.manageUrl }
        : { label: "View event", url: `${siteOrigin()}/events/${event.slug}` };
    return {
        subject: `${options.subject ?? title}: ${event.title}`,
        text: [
            title,
            options.description,
            eventText(event, options.summary),
            `${action.label}: ${action.url}`,
            ...links.map((link) => `${link.label}: ${link.url}`),
            `Legal: ${siteOrigin()}/legal`,
        ]
            .filter(Boolean)
            .join("\n\n"),
        html: layout({
            title,
            preview: `${title}: ${event.title}`,
            body: `${options.description ? paragraph(options.description) : ""}${eventDetails(event, options.summary)}`,
            action,
            links,
        }),
    };
}

/** Render a short-lived sign-in code without images or external fonts. */
export function signInEmail(code: string) {
    const expiry = "Expires in 10 minutes. If you didn’t request this, ignore this email.";
    return {
        subject: "Your zurich.tech sign-in code",
        text: `Sign in\n\n${code}\n\n${expiry}\n\nzurich.tech: ${siteOrigin()}\nLegal: ${siteOrigin()}/legal`,
        html: layout({
            title: "Sign in",
            preview: "Your zurich.tech sign-in code",
            body: `${paragraph("Your sign-in code:")}<p style="margin:20px 0;padding:16px 20px;background:#f1f3f5;border:1px solid #d5d9df;font:700 32px/1.4 Consolas,monospace;letter-spacing:6px">${escapeHtml(code)}</p>${paragraph(expiry)}`,
        }),
    };
}

/** Render a subscription or guest registration verification link. */
export function verificationEmail(url: string, event?: Event) {
    const title = event ? "Confirm email" : "Confirm subscription";
    const expiry = "Expires in one hour. If you didn’t request this, ignore this email.";
    return {
        subject: event ? `Confirm your email: ${event.title}` : "Confirm your subscription",
        text: [
            title,
            event ? eventText(event) : undefined,
            expiry,
            `${title}: ${url}`,
            `zurich.tech: ${siteOrigin()}`,
            `Legal: ${siteOrigin()}/legal`,
        ]
            .filter(Boolean)
            .join("\n\n"),
        html: layout({
            title,
            body: `${event ? eventDetails(event) : ""}${paragraph(expiry)}`,
            action: { label: title, url },
        }),
    };
}

/** Render the same edition for the workspace preview and delivered email. */
export function newsletterEdition(
    entries: Event[],
    sponsors: Awaited<ReturnType<typeof activeSponsors>>,
) {
    // render event listings with the same typography as individual notifications
    const events = entries
        .map(
            (entry) =>
                `<div style="padding:20px 0;border-bottom:1px solid #d5d9df">${eventDetails(entry, true)}</div>`,
        )
        .join("");

    // render eligible sponsor logos in tier order
    const recognition = tiers
        .filter((tier) => tier.newsletter)
        .flatMap((tier) => {
            const selected = sponsors.filter((sponsor) => sponsor.tier === tier.id);
            if (!selected.length) return [];
            const logos = selected
                .map(
                    (sponsor) =>
                        `<a href="${escapeHtml(sponsor.profileUrl ?? sponsor.website)}" style="display:inline-block;padding:12px;color:#174ed8">${sponsor.logoUrl ? `<img src="${escapeHtml(new URL(emailLogos[sponsor.logoUrl] ?? sponsor.logoUrl, siteOrigin()).href)}" alt="${escapeHtml(sponsor.name)}" width="${tier.logoWidth}" style="max-height:80px;object-fit:contain">` : escapeHtml(sponsor.name)}</a>`,
                )
                .join("");

            return [
                {
                    html: `<section style="padding:20px 0"><h2 style="font-size:14px">${tier.name} sponsors</h2>${logos}</section>`,
                    text: `${tier.name} sponsors\n${selected.map((sponsor) => `${sponsor.name} · ${sponsor.profileUrl ?? sponsor.website}`).join("\n")}`,
                },
            ];
        });

    return {
        html: events + recognition.map((section) => section.html).join(""),
        text: [
            ...entries.map((entry) => eventText(entry, true)),
            ...recognition.map((section) => section.text),
        ].join("\n\n"),
    };
}

/** Render a weekly edition with the recipient's notification links. */
export function newsletterEmail(edition: { text: string; html: string }, unsubscribeUrl?: string) {
    const links = [{ label: "Notifications", url: `${siteOrigin()}/settings` }];
    if (unsubscribeUrl) links.push({ label: "Unsubscribe", url: unsubscribeUrl });
    return {
        subject: "This week at zurich.tech",
        text: [
            "Upcoming events",
            edition.text,
            ...links.map((link) => `${link.label}: ${link.url}`),
            `Legal: ${siteOrigin()}/legal`,
        ].join("\n\n"),
        html: layout({ title: "Upcoming events", body: edition.html, links }),
    };
}
