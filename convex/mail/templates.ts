import { locationsLabel, jobFacts } from "../../src/jobs/format";
import { newsPath } from "../../src/news/path";
import { markdown, excerpt } from "./markdown";
import type { openJobs } from "../jobs/jobs";
import { notificationChanges } from "../events/changes";
import { isTentative } from "../events/conditions";
import type { Recurrence } from "../events/recurrence";
import type { AddressAccess } from "../events/fields";
import type { Confirmation } from "../events/fields";
import {
    layout,
    paragraph,
    escapeHtml,
    sectionHeading,
    palette,
    mono,
    text,
    socials,
} from "./layout";
import { involvement, sharing } from "./involvement";
import { tiers } from "../../src/sponsorships/plans";
import type { activeSponsors } from "../sponsorships/organisations";
import { siteOrigin } from "../auth/environment";
import type { Id } from "../_generated/dataModel";
import { welcome, resourcesPlaceholder } from "./attendance";
import { programmeContent, type Programme } from "./programme";

/** Raster equivalents of vector sponsor assets for email clients. */
const emailLogos: Record<string, string> = {
    "/sponsors/eth-ai-center.svg": "/sponsors/eth-ai-center.png",
};

/** Shared headline typography for digest listings. */
const listingFont = `500 18px/1.4 ${mono}`;

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
    /** Exclude link-only events from sharing suggestions. */
    visibility?: "public" | "unlisted";
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

    return `<h2 style="margin:0 0 6px;font:500 22px/1.25 ${mono};letter-spacing:0"><a href="${escapeHtml(url)}" style="color:${palette.ink};text-decoration:none">${escapeHtml(event.title)}</a></h2><p style="margin:0;color:${palette.soft};font-size:14px">${escapeHtml(time)}</p>${eventLocation(event)}${includeSummary && event.summary ? paragraph(event.summary) : ""}${isTentative(event) && event.status !== "cancelled" ? paragraph("Tentative · Awaiting event confirmation") : ""}`;
}

/** Frame event details consistently in registration and operational emails. */
function eventPanel(event: Event, includeSummary = false) {
    return `<div style="margin:24px 0 0;padding:20px;border-left:3px solid ${palette.brand};background:#f4f7ff">${eventDetails(event, includeSummary)}</div>`;
}

/** Keep expiry and security guidance subordinate to the primary action. */
function securityNote(value: string) {
    return `<p style="margin:20px 0 0;color:${palette.soft};font-size:14px;line-height:1.6">${escapeHtml(value)}</p>`;
}

/** Group the venue and its permitted address as one location. */
function eventLocation(event: Event) {
    const address = emailAddress(event);
    if (!event.location && !address) return "";

    return `<p style="margin:12px 0 0;line-height:1.5">${event.location ? `<strong>${escapeHtml(event.location)}</strong>` : ""}${event.location && address ? "<br>" : ""}${address ? `<span style="font-size:14px;color:${palette.soft}">${escapeHtml(address)}</span>` : ""}</p>`;
}

/** Registration subjects, headings and explanations. */
export const registrationCopy = {
    going: {
        title: "Registration confirmed",
        description: "Your place is confirmed.",
    },
    pending: {
        title: "Registration pending",
        description: "The organisers will review your registration and email you with an update.",
    },
    waitlist: {
        title: "Registration waitlisted",
        description:
            "You’re on the waiting list, but don’t have a confirmed place yet. We’ll email you if a place becomes available.",
    },
    declined: {
        title: "Registration declined",
        description:
            "Unfortunately, the organisers couldn’t confirm your registration for this event.",
    },
    cancelled: {
        title: "Registration cancelled",
        description: "You no longer have a place reserved for this event.",
    },
};

/** Friendly headings and context retain the exact meaning of each event state. */
const eventCopy: Record<string, { heading: string; description?: string }> = {
    "New event": {
        heading: "You’re invited",
        description: welcome,
    },
    "Registration confirmed": {
        heading: "You’re on the list",
        description: registrationCopy.going.description,
    },
    "Registration pending": {
        heading: "We’ve received your registration",
        description: registrationCopy.pending.description,
    },
    "Registration waitlisted": {
        heading: "You’re on the waiting list",
        description: registrationCopy.waitlist.description,
    },
    "Registration declined": {
        heading: "Registration declined",
        description: registrationCopy.declined.description,
    },
    "Registration cancelled": {
        heading: "Your registration is cancelled",
        description: registrationCopy.cancelled.description,
    },
    "Registration received": {
        heading: "You’re registered",
        description:
            "The event is still awaiting confirmation. We’ll let you know when it’s confirmed or cancelled.",
    },
    "Event reminder": {
        heading: "See you soon",
    },
    "Event updated": {
        heading: "Event details updated",
    },
    "Event confirmed": {
        heading: "Event confirmed",
        description: "The event is going ahead. Your registration status is unchanged.",
    },
    "Event cancelled": {
        heading: "This event has been cancelled",
    },
    "Thank you": {
        heading: "Thank you",
    },
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
    const weekday = date.toLocaleDateString("en-GB", {
        timeZone: "Europe/Zurich",
        weekday: "long",
    });

    return `${weekday}, ${day} · ${time} · Zurich time`;
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
        eventId?: Id<"events">;
        programme?: Programme;
        subject?: string;
        actionLabel?: string;
        passUrl?: string;
        description?: string;
        summary?: boolean;
        manageUrl?: string;
        unsubscribeUrl?: string;
        sponsors?: Parameters<typeof newsletterEdition>[1];
        jobs?: Parameters<typeof newsletterEdition>[2];
    } = {},
) {
    const copy = eventCopy[title];
    const description = options.description ?? copy?.description;
    const isInvitation = title === "New event";
    const programme = programmeContent(options.programme);
    // keep operational messages focused and never promote link-only or unpublished events
    const hasParticipation = [
        "New event",
        "Registration confirmed",
        "Event reminder",
        "Thank you",
    ].includes(title);
    const isShareable =
        event.visibility !== "unlisted" && event.status !== "draft" && event.status !== "cancelled";
    const share =
        hasParticipation && isShareable
            ? sharing(
                  title === "Thank you" ? "Share the Event" : "Bring Someone Along",
                  title === "Thank you"
                      ? "Share the event page with someone who would be interested."
                      : "Invite someone who would enjoy this event.",
                  `/events/${event.slug}`,
              )
            : { html: "", text: "" };
    const participation =
        hasParticipation && isShareable ? involvement(undefined, share) : { html: "", text: "" };
    const links = [
        { label: "Email preferences", url: `${siteOrigin()}/settings?section=notifications` },
    ];
    // keep promotional sections out of operational notifications
    const additions = hasParticipation
        ? emailListings(options.sponsors ?? [], options.jobs ?? [])
        : { html: "", text: "" };
    if (options.unsubscribeUrl) links.push({ label: "Unsubscribe", url: options.unsubscribeUrl });
    const action = options.manageUrl
        ? {
              label: options.actionLabel ?? (options.passUrl ? "View pass" : "Manage registration"),
              url: options.manageUrl,
          }
        : {
              label: "View event",
              url: `${siteOrigin()}/events/${event.slug}`,
          };
    return {
        subject: `${event.title}: ${options.subject ?? title}`,
        attendance:
            title === "New event" && options.eventId && options.description === undefined
                ? { kind: "invitation" as const, eventId: options.eventId }
                : undefined,
        text: [
            title,
            description,
            eventText(event, options.summary),
            programme.text,
            `${action.label}: ${action.url}`,
            participation.text,
            additions.text,
            ...links.map((link) => `${link.label}: ${link.url}`),
            `Legal: ${siteOrigin()}/legal`,
        ]
            .filter(Boolean)
            .join("\n\n"),
        html: layout({
            title: isInvitation ? event.title : (copy?.heading ?? title),
            eyebrow: isInvitation
                ? "You’re invited"
                : copy?.heading && copy.heading !== title
                  ? title
                  : undefined,
            preview: `${eventTime(event.startsAt)}${event.location ? ` · ${event.location}` : ""}. ${description ?? ""}`,
            body: isInvitation
                ? `${description ? paragraph(description) : ""}${options.summary && event.summary ? paragraph(event.summary) : ""}${programme.html}${sectionHeading("When & where")}<p style="margin:16px 0 0;font-weight:600">${escapeHtml(eventTime(event.startsAt))}</p>${eventLocation(event)}${isTentative(event) ? paragraph("Tentative · Awaiting event confirmation") : ""}`
                : `${description ? paragraph(description) : ""}${eventPanel(event, options.summary)}${programme.html}`,
            afterAction:
                (options.passUrl
                    ? `${sectionHeading("Your check-in pass")}<p style="margin:16px 0;font-size:14px;color:${palette.soft}">Show this code at the door, or open your pass using the button above.</p><img src="${escapeHtml(options.passUrl)}" alt="Your check-in QR code. Use View pass if images are unavailable." width="216" height="216" style="display:block;width:216px;max-width:100%;height:auto;background:#ffffff;border:12px solid #ffffff" />`
                    : "") +
                participation.html +
                additions.html,
            action,
            links,
        }),
    };
}

/** Render sponsors followed by eligible jobs below an email's main content. */
function emailListings(
    sponsors: Parameters<typeof newsletterEdition>[1],
    jobs: NonNullable<Parameters<typeof newsletterEdition>[2]>,
    isCompact = true,
) {
    // limit each organisation equally and link the complete board
    const vacancies = selectJobs(jobs).map((job) => jobListing(job, isCompact));

    // preserve the newsletter's sponsor ordering and relative logo sizes
    const recognition = sponsorRecognition(sponsors);

    return {
        html:
            (recognition.length
                ? `${sectionHeading("Sponsors", `${siteOrigin()}/sponsor`)}${recognition.map((section) => section.logos).join("")}`
                : "") +
            (vacancies.length
                ? `${sectionHeading("Jobs", `${siteOrigin()}/jobs`)}${vacancies.map((job) => job.html).join("")}<p><a href="${escapeHtml(`${siteOrigin()}/jobs`)}" style="color:${palette.brand}">All jobs &rarr;</a></p>`
                : ""),
        text: [
            recognition.length
                ? `Sponsors\n${recognition.map((section) => section.text).join("\n")}`
                : "",
            vacancies.length
                ? `Jobs\n\n${vacancies.map((job) => job.text).join("\n\n")}\n\nAll jobs: ${siteOrigin()}/jobs`
                : "",
        ]
            .filter(Boolean)
            .join("\n\n"),
    };
}

/** Render a short-lived sign-in code as selectable text. */
export function signInEmail(code: string) {
    const expiry = "Expires in 10 minutes. If you didn’t request this, ignore this email.";
    return {
        subject: "Your zurich.tech sign-in code",
        text: `Your sign-in code\n\nEnter this code on the sign-in page to continue.\n\n${code}\n\n${expiry}\n\nzurich.tech: ${siteOrigin()}\nLegal: ${siteOrigin()}/legal`,
        html: layout({
            title: "Your sign-in code",
            preview: "Use this code to sign in. It expires in 10 minutes.",
            body: `${paragraph("Enter this code on the sign-in page to continue.")}<p style="margin:24px 0;padding:20px;background:#f4f7ff;border-left:3px solid ${palette.brand};font:700 32px/1.4 ${mono};letter-spacing:0">${escapeHtml(code)}</p>${securityNote(expiry)}`,
        }),
    };
}

/** Render a subscription or guest registration verification link. */
export function verificationEmail(url: string, event?: Event) {
    const title = event ? "Confirm registration" : "Confirm subscription";
    const expiry = "Expires in one hour. If you didn’t request this, ignore this email.";
    const description = event
        ? "Confirm your email address to finish submitting your registration. We’ll then email you your registration status."
        : "Confirm your email address to receive zurich.tech emails. You can change your preferences or unsubscribe at any time.";
    // verification precedes identity resolution, so never assume an account or emit placeholders
    const participation = involvement("none", { html: "", text: "" });

    return {
        subject: event ? `${event.title}: Confirm your registration` : "Confirm your subscription",
        text: [
            title,
            description,
            event ? eventText(event) : undefined,
            `${title}: ${url}`,
            expiry,
            participation.text,
            `zurich.tech: ${siteOrigin()}`,
            `Legal: ${siteOrigin()}/legal`,
        ]
            .filter(Boolean)
            .join("\n\n"),
        html: layout({
            title,
            preview: description,
            body: `${paragraph(description)}${event ? eventPanel(event) : ""}`,
            action: { label: title, url },
            afterAction: securityNote(expiry) + participation.html,
        }),
    };
}

/** Render the same edition for the workspace preview and delivered email. */
export function newsletterEdition(
    entries: Event[],
    sponsors: Pick<
        Awaited<ReturnType<typeof activeSponsors>>[number],
        "tier" | "name" | "website" | "profileUrl" | "logoUrl"
    >[],
    jobs: (Pick<
        Awaited<ReturnType<typeof openJobs>>[number],
        | "slug"
        | "title"
        | "locations"
        | "workplace"
        | "engagement"
        | "workload"
        | "compensation"
        | "summary"
    > & { company: { slug: string; name: string; logoUrl?: string } })[] = [],
    options: { news?: NewsletterStory[]; date?: number } = {},
) {
    // keep addresses and external address instructions on the event page
    const listings = entries.map((entry) => ({
        ...entry,
        address: undefined,
        addressAccess: undefined,
    }));

    // align event dates and headlines in one unboxed digest grid
    const events = listings
        .map((entry, index) => {
            const time = new Date(entry.startsAt).toLocaleTimeString("en-GB", {
                timeZone: "Europe/Zurich",
                hour: "2-digit",
                minute: "2-digit",
            });
            const details = [
                time,
                entry.location,
                isTentative(entry) && entry.status !== "cancelled"
                    ? "Tentative · Awaiting event confirmation"
                    : undefined,
            ]
                .filter(Boolean)
                .join(" · ");

            return digestListing(
                entry.title,
                `${siteOrigin()}/events/${entry.slug}`,
                entry.startsAt,
                entry.summary ?? "",
                details,
                index > 0,
            );
        })
        .join("");

    // retain the shared sponsor ordering and job selection across email families
    const additions = emailListings(sponsors, jobs, false);

    // render published stories without a generic introduction
    const news = (options.news ?? []).map((story) => ({
        ...story,
        description: newsSentence(story.description),
    }));
    const stories = news.map((story, index) => ({
        html: digestListing(
            story.title,
            `${siteOrigin()}${newsPath(story)}`,
            story.date,
            story.description,
            "",
            index > 0,
        ),
        text: `${story.title}\n${story.description}\n${siteOrigin()}${newsPath(story)}`,
    }));
    const participation = involvement();

    return {
        date: options.date,
        preview: listings[0]?.title ?? news[0]?.title ?? jobs[0]?.title,
        html:
            (events ? `${sectionHeading("Events", `${siteOrigin()}/events`)}${events}` : "") +
            (stories.length
                ? `${sectionHeading("News", `${siteOrigin()}/news`)}${stories.map((story) => story.html).join("")}`
                : "") +
            (options.date === undefined ? "" : resourcesPlaceholder.html) +
            participation.html +
            additions.html,
        text: [
            ...listings.map((entry) => eventText(entry, true)),
            ...stories.map((story) => story.text),
            options.date === undefined ? "" : resourcesPlaceholder.text,
            participation.text,
            additions.text,
        ].join("\n\n"),
    };
}

/** Render an email-safe date column beside a digest headline and short description. */
function digestListing(
    title: string,
    url: string,
    date: number,
    description: string,
    details: string,
    isSeparated: boolean,
) {
    const day = new Date(date).toLocaleDateString("en-GB", {
        timeZone: "Europe/Zurich",
        day: "numeric",
    });
    const month = new Date(date).toLocaleDateString("en-GB", {
        timeZone: "Europe/Zurich",
        month: "short",
    });
    const border = isSeparated ? `border-top:1px solid ${palette.line};` : "";

    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;${border}"><tr><td width="52" valign="top" style="padding:18px 0;color:${palette.soft};font:13px/1.5 ${mono}"><span style="font-size:22px;line-height:1.2">${day}</span><br>${month}</td><td valign="top" style="padding:18px 0 18px 16px"><h3 style="margin:0;font:${listingFont}"><a href="${escapeHtml(url)}" style="color:${palette.ink};text-decoration:none">${escapeHtml(title)}</a></h3>${details ? `<p style="margin:5px 0 0;color:${palette.soft};font:13px/1.5 ${text}">${escapeHtml(details)}</p>` : ""}${description ? `<p style="margin:8px 0 0;font:14px/1.6 ${text}">${escapeHtml(description)}</p>` : ""}</td></tr></table>`;
}

/** Extract the opening sentence for a newsletter without splitting decimal numbers. */
export function newsSentence(description: string): string {
    const sentences = new Intl.Segmenter("en", { granularity: "sentence" });

    for (const sentence of sentences.segment(description.trim())) {
        return sentence.segment.trim().replace(/\s+/g, " ");
    }

    return "";
}

/** Select at most two jobs per organisation, retaining the newest-first input order. */
function selectJobs(jobs: NonNullable<Parameters<typeof newsletterEdition>[2]>) {
    const counts = new Map<string, number>();

    // use organisation identity rather than potentially shared display names
    return jobs.filter((job) => {
        const count = counts.get(job.company.slug) ?? 0;
        counts.set(job.company.slug, count + 1);

        return count < 2;
    });
}

/** Render eligible sponsor logos in tier order for newsletters and event emails. */
function sponsorRecognition(sponsors: Parameters<typeof newsletterEdition>[1]) {
    return tiers
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
                    logos: `<div style="padding:12px 0">${logos}</div>`,
                    text: `${tier.name} sponsors\n${selected.map((sponsor) => `${sponsor.name} · ${sponsor.profileUrl ?? sponsor.website}`).join("\n")}`,
                },
            ];
        });
}

/** Render one public vacancy with its company image and application details. */
function jobListing(
    job: NonNullable<Parameters<typeof newsletterEdition>[2]>[number],
    isCompact = false,
) {
    const url = `${siteOrigin()}/jobs/${job.slug}`;
    const details = [job.company.name, locationsLabel(job.locations)].filter(Boolean).join(" · ");
    const facts = jobFacts(job);
    const heading = `<h3 style="margin:0 0 6px;font:${listingFont};letter-spacing:0"><a style="color:${palette.ink};text-decoration:none" href="${escapeHtml(url)}">${escapeHtml(job.title)}</a></h3><p style="margin:0;color:${palette.soft};font-size:13px">${escapeHtml(details)}</p>`;

    // use the same 52px column and 16px gutter as event and news listings
    const logo = job.company.logoUrl;
    const image = logo
        ? `<a href="${escapeHtml(url)}"><img src="${escapeHtml(new URL(emailLogos[logo] ?? logo, siteOrigin()).href)}" alt="${escapeHtml(job.company.name)}" width="52" height="52" style="display:block;width:52px;height:52px;object-fit:contain;border:0" /></a>`
        : "";
    const description = isCompact
        ? ""
        : `<p style="margin:6px 0 0;color:${palette.soft};font-size:13px">${escapeHtml(facts.join(" · "))}</p><p style="margin:8px 0 0;font:14px/1.6 ${text}">${escapeHtml(job.summary)} <a href="${escapeHtml(url)}" style="color:${palette.brand}">View role &rarr;</a></p>`;

    return {
        html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr><td width="52" valign="top" style="padding:16px 0">${image}</td><td valign="top" style="padding:16px 0 16px 16px">${heading}${description}</td></tr></table>`,
        text: isCompact
            ? `${job.title}\n${details}\n${url}`
            : `${job.title}\n${details}\n${facts.join(" · ")}\n${job.summary}\n${url}`,
    };
}

/** Published article copy frozen into one newsletter edition. */
export type NewsletterStory = { title: string; slug: string; date: number; description: string };

/** Render a weekly edition with the recipient's notification links. */
export function newsletterEmail(
    edition: { text: string; html: string; preview?: string; date?: number },
    unsubscribeUrl?: string,
) {
    const links = [
        { label: "Email preferences", url: `${siteOrigin()}/settings?section=notifications` },
    ];
    if (unsubscribeUrl) links.push({ label: "Unsubscribe", url: unsubscribeUrl });
    return {
        subject: "This week in zurich.tech",
        text: [
            "This week in zurich.tech",
            edition.date === undefined ? "" : editionDate(edition.date),
            edition.text,
            ...socials.map((link) => `${link.label}: ${link.url}`),
            ...links.map((link) => `${link.label}: ${link.url}`),
            `Legal: ${siteOrigin()}/legal`,
        ]
            .filter(Boolean)
            .join("\n\n"),
        html: layout({
            title: "This week in zurich.tech",
            eyebrow: edition.date === undefined ? undefined : editionDate(edition.date),
            preview: edition.preview,
            body: edition.html,
            links,
            isCommunity: true,
        }),
        attendance:
            edition.date === undefined
                ? undefined
                : {
                      kind: "resources" as const,
                      since: edition.date - 7 * 86400000,
                      until: edition.date,
                  },
    };
}

/** Label an edition by its local publication date, not the recipient's delivery time. */
function editionDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString("en-GB", {
        timeZone: "Europe/Zurich",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

/** Render the once-only launch announcement for a recurring series. */
export function seriesEmail(
    series: { name: string; slug: string; description: string },
    rule: Recurrence,
    unsubscribeUrl: string,
    listings: {
        sponsors?: Parameters<typeof newsletterEdition>[1];
        jobs?: Parameters<typeof newsletterEdition>[2];
    } = {},
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
    const dates = `From ${editionDate(Date.parse(`${rule.start}T12:00:00Z`))}${rule.end ? ` until ${editionDate(Date.parse(`${rule.end}T12:00:00Z`))}` : ""}`;
    const url = `${siteOrigin()}/series/${series.slug}`;
    const links = [
        { label: "Email preferences", url: `${siteOrigin()}/settings?section=notifications` },
        { label: "Unsubscribe", url: unsubscribeUrl },
    ];
    const subject = `New series: ${series.name}`;
    const participation = involvement();
    const additions = emailListings(listings.sponsors ?? [], listings.jobs ?? []);
    return {
        subject,
        text: [
            subject,
            timing,
            dates,
            series.description,
            `View events: ${url}`,
            participation.text,
            additions.text,
            ...socials.map((link) => `${link.label}: ${link.url}`),
            ...links.map((link) => `${link.label}: ${link.url}`),
        ].join("\n\n"),
        html: layout({
            title: series.name,
            eyebrow: "New series",
            preview: `${timing}. ${series.description}`,
            body: `${paragraph(series.description)}<p style="color:${palette.soft}">${escapeHtml(timing)}<br>${escapeHtml(dates)}</p>`,
            action: { label: "View events", url },
            afterAction: participation.html + additions.html,
            links,
            isCommunity: true,
        }),
    };
}

/** Use the same email frame and private preferences as other communications. */
export function campaignEmail(
    campaign: { subject: string; message: string },
    unsubscribeUrl?: string,
    listings: {
        sponsors?: Parameters<typeof newsletterEdition>[1];
        jobs?: Parameters<typeof newsletterEdition>[2];
    } = {},
) {
    const origin = siteOrigin();
    const participation = involvement();
    const additions = emailListings(listings.sponsors ?? [], listings.jobs ?? []);
    const links = [{ label: "Email preferences", url: `${origin}/settings?section=notifications` }];
    if (unsubscribeUrl) links.push({ label: "Unsubscribe", url: unsubscribeUrl });
    return {
        subject: campaign.subject,
        text: [
            campaign.message,
            participation.text,
            additions.text,
            ...socials.map((link) => `${link.label}: ${link.url}`),
            `zurich.tech: ${origin}`,
            ...links.map((link) => `${link.label}: ${link.url}`),
            `Legal: ${origin}/legal`,
        ].join("\n\n"),
        html: layout({
            title: campaign.subject,
            preview: excerpt(campaign.message),
            body: markdown(campaign.message),
            afterAction: participation.html + additions.html,
            links,
            isCommunity: true,
        }),
    };
}
