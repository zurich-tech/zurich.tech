import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { Content } from "./model";
import { siteOrigin } from "../auth/environment";
import { isListed } from "../events/visibility";
import { escapeHtml, paragraph, sectionHeading } from "./layout";

/** Default invitation for recipients without a checked-in event in this series. */
export const welcome = "Join us for a new event in Zurich.";

/** Replace this section only after resolving the recipient's attendance. */
export const resourcesPlaceholder = {
    html: "<!--zurich.tech:attendance-->",
    text: "[[zurich.tech:attendance]]",
};

/** Refer to a checked-in event without implying attendance at the upcoming one. */
export function invitationCopy(previous?: string) {
    const text = previous
        ? `You joined us for ${previous}. Here’s another event in the series.`
        : welcome;

    return { text, html: paragraph(text) };
}

/** Render links to newly added resources without exposing private event content. */
export function attendedResources(
    events: { title: string; slug: string; hasPhotos: boolean; hasLinks: boolean }[],
) {
    if (!events.length) return { html: "", text: "" };
    const title = "From events you attended";

    return {
        html:
            sectionHeading(title) +
            events
                .map(
                    (event) =>
                        `<p style="margin:16px 0"><a href="${escapeHtml(`${siteOrigin()}/events/${event.slug}${event.hasLinks ? "" : "#photos"}`)}">${escapeHtml(event.title)}</a><br>${event.hasPhotos && event.hasLinks ? "Photos and event links" : event.hasPhotos ? "Photos" : "Event links"}</p>`,
                )
                .join(""),
        text: [
            title,
            ...events.map(
                (event) =>
                    `${event.title}\n${event.hasPhotos && event.hasLinks ? "Photos and event links" : event.hasPhotos ? "Photos" : "Event links"}: ${siteOrigin()}/events/${event.slug}${event.hasLinks ? "" : "#photos"}`,
            ),
        ].join("\n\n"),
    };
}

/** Read confirmed attendance by member and delivery address, never infer it from an RSVP. */
export async function attendanceCopy(
    ctx: Pick<QueryCtx, "db">,
    request: NonNullable<Content["attendance"]>,
    email: string,
    memberId?: Id<"members">,
) {
    const arrivals = await ctx.db
        .query("attendances")
        .withIndex("by_email", (q) => q.eq("email", email))
        .collect();
    if (memberId)
        arrivals.push(
            ...(await ctx.db
                .query("attendances")
                .withIndex("by_member", (q) => q.eq("memberId", memberId))
                .collect()),
        );
    const now = request.kind === "resources" ? request.until : Date.now();
    const ids = new Set(arrivals.filter((row) => row.checkedInAt <= now).map((row) => row.eventId));
    const events = [];
    for (const id of ids) {
        const event = await ctx.db.get(id);
        if (
            event &&
            isListed(event) &&
            event.status !== "cancelled" &&
            (event.endsAt ?? event.startsAt) < now
        )
            events.push(event);
    }
    events.sort((left, right) => right.startsAt - left.startsAt);

    // relate invitations only within an explicit series, not a guessed topic match
    if (request.kind === "invitation") {
        const upcoming = await ctx.db.get(request.eventId);
        const previous = upcoming?.seriesId
            ? events.find(
                  (event) => event.seriesId === upcoming.seriesId && event._id !== upcoming._id,
              )
            : undefined;
        return invitationCopy(previous?.title);
    }

    // use creation time, not edits to captions or titles, to avoid repeating old resources
    const selected = [];
    for (const event of events) {
        const links = await ctx.db
            .query("links")
            .withIndex("by_owner", (q) => q.eq("ownerId", event._id))
            .collect();
        const photos = await ctx.db
            .query("photos")
            .withIndex("by_event_and_position", (q) => q.eq("eventId", event._id))
            .collect();
        const hasLinks = links.some(
            (link) =>
                link.visibility === "public" &&
                link.createdAt > request.since &&
                link.createdAt <= request.until &&
                link.createdAt >= event.startsAt,
        );
        const hasPhotos = photos.some(
            (photo) =>
                photo.status === "approved" &&
                photo.createdAt > request.since &&
                photo.createdAt <= request.until &&
                photo.createdAt >= event.startsAt,
        );
        if (hasLinks || hasPhotos) selected.push({ ...event, hasLinks, hasPhotos });
        if (selected.length === 3) break;
    }

    return attendedResources(selected);
}
