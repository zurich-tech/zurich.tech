import { locationsLabel, jobFacts } from "../../src/jobs/format";
import { markdown } from "./markdown";
import type { openJobs } from "../jobs/jobs";
import { notificationChanges } from "../events/changes";
import { isTentative } from "../events/conditions";
import type { Recurrence } from "../events/recurrence";
import type { AddressAccess } from "../events/fields";
import type { Confirmation } from "../events/fields";
import { layout, paragraph, escapeHtml, sectionHeading, palette, mono } from "./layout";
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
    address?: string;
    addressAccess?: AddressAccess;
    summary?: string;
    confirmation?: Confirmation;
    confirmedAt?: number;
    status?: string;
};

/** Describe address access without exposing restricted content in a public email. */
function emailAddress(event: Event) {
    switch (event.addressAccess?.kind) {
        case "confirmed":
            return "Address shared after registration confirmation. View your registration for details.";
        case "external":
            return `View address on ${event.addressAccess.label}: ${event.addressAccess.url}`;
        case "unannounced":
            return "Venue to be announced.";
        default:
            return event.address;
    }
}

/** Render an event title, local date, venue and optional summary. */
export function eventDetails(event: Event, includeSummary = false) {
    const url = `${siteOrigin()}/events/${event.slug}`;
    const time = eventTime(event.startsAt);
    return `<h2 style="margin:0 0 6px;font:500 22px/1.25 ${mono};letter-spacing:-0.5px"><a href="${escapeHtml(url)}" style="color:${palette.ink};text-decoration:none">${escapeHtml(event.title)}</a></h2><p style="margin:0;color:${palette.soft};font-size:14px">${escapeHtml(time)}${event.location ? `<br>${escapeHtml(event.location)}` : ""}</p>${emailAddress(event) ? paragraph(emailAddress(event)!) : ""}${includeSummary && event.summary ? paragraph(event.summary) : ""}${isTentative(event) && event.status !== "cancelled" ? paragraph("Tentative · Awaiting event confirmation") : ""}`;
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

/** Format an event date and time consistently in Zurich. */
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
    return `${day} · ${time} · Zurich time`;
}

/** Render public event details as plain text. */
export function eventText(event: Event, includeSummary = false) {
    return [
        event.title,
        isTentative(event) && event.status !== "cancelled"
            ? "Tentative · Awaiting event confirmation"
            : undefined,
        eventTime(event.startsAt),
        event.location,
        emailAddress(event),
        includeSummary ? event.summary : undefined,
        `${siteOrigin()}/events/${event.slug}`,
    ]
        .filter(Boolean)
        .join("\n");
}

/** Describe each changed time or venue with its previous and current value. */
export function eventChanges(previous: Event, current: Event) {
    const changed = notificationChanges(previous, current);
    const previousAddress = emailAddress(previous);
    const currentAddress = emailAddress(current);
    const changes: string[] = [];
    if (changed.includes("Start"))
        changes.push(`Start: ${eventTime(previous.startsAt)} → ${eventTime(current.startsAt)}`);
    if (changed.includes("End"))
        changes.push(
            `End: ${previous.endsAt ? eventTime(previous.endsAt) : "Not specified"} → ${current.endsAt ? eventTime(current.endsAt) : "Not specified"}`,
        );
    if (changed.includes("Venue"))
        changes.push(
            `Venue: ${previous.location || "Not specified"} → ${current.location || "Not specified"}`,
        );
    if (changed.includes("Address") || changed.includes("Address visibility"))
        changes.push(
            previousAddress !== currentAddress
                ? `Address: ${previousAddress || "Not specified"} → ${currentAddress || "Not specified"}`
                : "Address details changed. View your registration for the current address.",
        );
    return changes.join("\n");
}

/** Render an announcement, reminder or registration update in both email formats. */
export function eventEmail(
    event: Event,
    title: string,
    options: {
        subject?: string;
        actionLabel?: string;
        passUrl?: string;
        description?: string;
        summary?: boolean;
        manageUrl?: string;
        unsubscribeUrl?: string;
    } = {},
) {
    const links = [{ label: "Notifications", url: `${siteOrigin()}/settings` }];
    if (options.unsubscribeUrl) links.push({ label: "Unsubscribe", url: options.unsubscribeUrl });
    const action = options.manageUrl
        ? {
              label: options.actionLabel ?? (options.passUrl ? "View pass" : "Manage registration"),
              url: options.manageUrl,
          }
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
            body: `${options.description ? paragraph(options.description) : ""}${eventDetails(event, options.summary)}${options.passUrl ? `<p style="margin:24px 0"><img src="${escapeHtml(options.passUrl)}" alt="Your check-in QR code" width="240" height="240" style="display:block;width:240px;height:240px;background:#ffffff;padding:12px" /></p>` : ""}`,
            action,
            links,
        }),
    };
}

/** Render a short-lived sign-in code as selectable text. */
export function signInEmail(code: string) {
    const expiry = "Expires in 10 minutes. If you didn’t request this, ignore this email.";
    return {
        subject: "Your zurich.tech sign-in code",
        text: `Sign in\n\n${code}\n\n${expiry}\n\nzurich.tech: ${siteOrigin()}\nLegal: ${siteOrigin()}/legal`,
        html: layout({
            title: "Sign in",
            preview: "Your zurich.tech sign-in code",
            body: `${paragraph("Your sign-in code:")}<p style="margin:20px 0;padding:16px 20px;background:${palette.wash};border-left:4px solid ${palette.brand};font:700 32px/1.4 ${mono};letter-spacing:6px">${escapeHtml(code)}</p>${paragraph(expiry)}`,
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
    jobs: Awaited<ReturnType<typeof openJobs>> = [],
) {
    // Keep addresses and external address instructions on the event page.
    const listings = entries.map((entry) => ({
        ...entry,
        address: undefined,
        addressAccess: undefined,
    }));

    // render event listings with the same typography as individual notifications
    const events = listings
        .map(
            (entry) =>
                `<div style="padding:20px 0;border-bottom:1px solid ${palette.line}">${eventDetails(entry, true)}</div>`,
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
                        `<a href="${escapeHtml(sponsor.profileUrl ?? sponsor.website)}" style="display:inline-block;padding:12px;color:${palette.brand}">${sponsor.logoUrl ? `<img src="${escapeHtml(new URL(emailLogos[sponsor.logoUrl] ?? sponsor.logoUrl, siteOrigin()).href)}" alt="${escapeHtml(sponsor.name)}" width="${tier.logoWidth}" style="max-height:80px;object-fit:contain">` : escapeHtml(sponsor.name)}</a>`,
                )
                .join("");

            return [
                {
                    html: `${sectionHeading(`${tier.name} sponsors`)}<div style="padding:12px 0">${logos}</div>`,
                    text: `${tier.name} sponsors\n${selected.map((sponsor) => `${sponsor.name} · ${sponsor.profileUrl ?? sponsor.website}`).join("\n")}`,
                },
            ];
        });

    // include only eligible jobs, linking to their complete public listing
    const vacancies = jobs.map((job) => {
        const url = `${siteOrigin()}/jobs/${job.slug}`;
        const details = [job.company.name, locationsLabel(job.locations)]
            .filter(Boolean)
            .join(" · ");
        const facts = jobFacts(job);
        const badges = facts
            .map(
                (label) =>
                    `<span style="display:inline-block;margin:0 6px 6px 0;padding:2px 8px;background:${palette.brand};color:#ffffff;font-size:12px;font-weight:600">${escapeHtml(label)}</span>`,
            )
            .join("");
        return {
            html: `<div style="padding:20px 0;border-bottom:1px solid ${palette.line}"><h3 style="margin:0 0 6px;font:500 20px/1.25 ${mono};letter-spacing:-0.5px"><a style="color:${palette.ink};text-decoration:none" href="${escapeHtml(url)}">${escapeHtml(job.title)}</a></h3><p style="margin:0;color:${palette.soft};font-size:14px">${escapeHtml(details)}</p><p style="margin:8px 0 0">${badges}</p>${paragraph(job.summary)}</div>`,
            text: `${job.title}\n${details}\n${facts.join(" · ")}\n${job.summary}\n${url}`,
        };
    });

    return {
        html:
            (events ? `${sectionHeading("Upcoming events")}${events}` : "") +
            (vacancies.length
                ? `${sectionHeading("Jobs")}${vacancies.map((job) => job.html).join("")}`
                : "") +
            recognition.map((section) => section.html).join(""),
        text: [
            ...listings.map((entry) => eventText(entry, true)),
            ...vacancies.map((job) => job.text),
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
            "This week at zurich.tech",
            edition.text,
            ...links.map((link) => `${link.label}: ${link.url}`),
            `Legal: ${siteOrigin()}/legal`,
        ].join("\n\n"),
        html: layout({ title: "This week at zurich.tech", body: edition.html, links }),
    };
}

/** Render the once-only launch announcement for a recurring series. */
export function seriesEmail(
    series: { name: string; slug: string; description: string },
    rule: Recurrence,
    unsubscribeUrl: string,
) {
    const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const unit = { daily: "day", weekly: "week", monthly: "month" }[rule.frequency];
    const cadence = `Every ${rule.interval === 1 ? unit : `${rule.interval} ${unit}s`}`;
    const days =
        rule.frequency === "weekly"
            ? rule.weekdays.map((day) => weekdays[day]).join(", ")
            : rule.frequency === "monthly"
              ? `Day ${Number(rule.start.slice(-2))}`
              : "";
    const timing = [cadence, days, rule.time, "Zurich time"].filter(Boolean).join(" · ");
    const dates = `From ${rule.start}${rule.end ? ` until ${rule.end}` : ""}`;
    const url = `${siteOrigin()}/series/${series.slug}`;
    const links = [
        { label: "Notifications", url: `${siteOrigin()}/settings` },
        { label: "Unsubscribe", url: unsubscribeUrl },
    ];
    const subject = `New series: ${series.name}`;
    return {
        subject,
        text: [
            subject,
            timing,
            dates,
            series.description,
            `View events: ${url}`,
            ...links.map((link) => `${link.label}: ${link.url}`),
        ].join("\n\n"),
        html: layout({
            title: "New series",
            body: `<h2>${escapeHtml(series.name)}</h2>${paragraph(timing)}${paragraph(dates)}${paragraph(series.description)}`,
            action: { label: "View events", url },
            links,
        }),
    };
}

/** Use the same email frame and private preferences as other communications. */
export function campaignEmail(
    campaign: { subject: string; message: string },
    unsubscribeUrl?: string,
) {
    const origin = siteOrigin();
    const links = [{ label: "Notifications", url: `${origin}/settings` }];
    if (unsubscribeUrl) links.push({ label: "Unsubscribe", url: unsubscribeUrl });
    return {
        subject: campaign.subject,
        text: [
            campaign.message,
            `zurich.tech: ${origin}`,
            ...links.map((link) => `${link.label}: ${link.url}`),
            `Legal: ${origin}/legal`,
        ].join("\n\n"),
        html: layout({
            title: campaign.subject,
            body: markdown(campaign.message),
            action: { label: "Visit zurich.tech", url: origin },
            links,
        }),
    };
}
