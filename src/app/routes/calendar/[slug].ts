import type { APIEvent } from "@solidjs/start/server";
import { api } from "../../../../convex/_generated/api";
import { publicClient } from "../../../auth/convex";
import { calendar } from "../../../events/calendar";

/** Download one published event as a calendar invitation. */
export async function GET(event: APIEvent) {
    const record = await publicClient().query(api.events.queries.event, {
        slug: event.params.slug,
        now: Date.now(),
    });
    if (!record) return new Response("Event not found", { status: 404 });

    return new Response(
        calendar(
            {
                ...record,
                location: [record.venue.name, record.venue.address].filter(Boolean).join(", "),
            },
            Date.now(),
        ),
        {
            headers: {
                "Content-Type": "text/calendar; charset=utf-8",
                "Content-Disposition": `attachment; filename="${record.slug}.ics"`,
            },
        },
    );
}
