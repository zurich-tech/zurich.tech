import { publicOrganisers } from "./organisers";
import { eventAttribution } from "./attribution";
import { calendarRow } from "./queries";
import { query } from "../_generated/server";
import { requireWorkspace, scopedEvents, scopedRevisions } from "../auth/grants";

/** Read unpublished planning entries without exposing them to public queries. */
export const planning = query({
    args: {},
    handler: async (ctx) => {
        const access = await requireWorkspace(ctx);
        const events = await scopedEvents(ctx, access);
        const submissions = await scopedRevisions(ctx, access, events);
        const drafts = submissions.filter(
            (draft) =>
                !draft.eventId ||
                events.find((event) => event._id === draft.eventId)?.status === "draft",
        );
        const revised = new Set(drafts.map((draft) => draft.eventId));
        const unpublished = await Promise.all(
            events
                .filter((event) => event.status === "draft" && !revised.has(event._id))
                .map(async (event) => ({
                    ...(await calendarRow(ctx, event)),
                    href: `/submit?event=${event._id}`,
                })),
        );

        return [
            ...unpublished,
            ...(await Promise.all(
                drafts.map(async (draft) => {
                    // resolve the same series for organiser credits and partnership
                    const series = draft.seriesId ? await ctx.db.get(draft.seriesId) : null;

                    return {
                        id: draft.eventId ?? draft._id,
                        href: `/submit?edit=${draft._id}`,
                        ...(await publicOrganisers(ctx, draft, series)),
                        slug: draft.slug,
                        title: draft.title,
                        summary: draft.summary,
                        startsAt: draft.startsAt,
                        location: draft.location,
                        topics: draft.topics,
                        seriesId: draft.seriesId,
                        status: "draft" as const,
                        confirmation: draft.confirmation,
                        confirmedAt: undefined,
                        registrationKind: draft.registration.kind,
                        isPartner:
                            eventAttribution(draft, series) === "external" ||
                            !!draft.partnerIds?.length,
                        capacity:
                            draft.registration.kind === "none"
                                ? undefined
                                : draft.registration.capacity,
                        rsvpCount: undefined,
                        waitlistCount: undefined,
                    };
                }),
            )),
        ];
    },
});
