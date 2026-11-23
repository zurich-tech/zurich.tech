import { query } from "../_generated/server";
import { v } from "convex/values";
import { speakerProfile } from "./queries";

/** Read only published information needed by an event sharing image. */
export const image = query({
    args: { slug: v.string() },
    handler: async (ctx, { slug }) => {
        // exclude unpublished events before reading their programme
        const event = await ctx.db
            .query("events")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .unique();
        if (!event || event.status === "draft") return null;

        // avoid registrations, photos, materials and other unrelated event records
        const [speakers, sessions] = await Promise.all([
            ctx.db
                .query("speakers")
                .withIndex("by_event_and_position", (q) => q.eq("eventId", event._id))
                .collect(),
            ctx.db
                .query("sessions")
                .withIndex("by_event_and_position", (q) => q.eq("eventId", event._id))
                .collect(),
        ]);
        const people = await Promise.all(
            speakers
                .filter((speaker) => !speaker.isRemoved)
                .map(async (speaker) => {
                    const profile = speaker.memberId
                        ? await speakerProfile(ctx, speaker.memberId)
                        : undefined;

                    return {
                        id: speaker._id,
                        name: speaker.name,
                        affiliations: speaker.affiliations ?? profile?.affiliations,
                        imageUrl: speaker.imageUrl ?? profile?.imageUrl,
                    };
                }),
        );

        return {
            title: event.title,
            startsAt: event.startsAt,
            status: event.status,
            speakers: people,
            sessions: sessions.map((session) => ({ speakerIds: session.speakerIds ?? [] })),
        };
    },
});
