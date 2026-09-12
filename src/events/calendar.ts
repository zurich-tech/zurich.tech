/** Export a dated event as an interoperable calendar file with folded UTF-8 lines. */
export function calendar(
    event: {
        slug: string;
        title: string;
        description?: string;
        startsAt: number;
        endsAt?: number;
        location?: string;
        status?: string;
        confirmation?: unknown;
        confirmedAt?: number;
    },
    now: number,
): string {
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//zurich.tech//Events//EN",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        `UID:${event.slug}@zurich.tech`,
        `DTSTAMP:${calendarTime(now)}`,
        `DTSTART:${calendarTime(event.startsAt)}`,
    ];
    if (event.endsAt !== undefined) lines.push(`DTEND:${calendarTime(event.endsAt)}`);
    lines.push(
        `SUMMARY:${calendarText(event.title)}`,
        `DESCRIPTION:${calendarText(event.description ?? "")}`,
        `LOCATION:${calendarText(event.location ?? "")}`,
        `URL:https://zurich.tech/events/${event.slug}`,
    );
    if (event.status === "cancelled") lines.push("STATUS:CANCELLED");
    else if (event.confirmation && event.confirmedAt === undefined) lines.push("STATUS:TENTATIVE");
    else lines.push("STATUS:CONFIRMED");
    lines.push("END:VEVENT", "END:VCALENDAR");
    const encoder = new TextEncoder();

    return (
        lines
            .map((line) => {
                let folded = "";
                let width = 0;
                for (const character of line) {
                    const bytes = encoder.encode(character).length;
                    if (width + bytes > 75) {
                        folded += "\r\n ";
                        width = 1;
                    }
                    folded += character;
                    width += bytes;
                }

                return folded;
            })
            .join("\r\n") + "\r\n"
    );
}

/** Escape one calendar text property according to RFC 5545. */
export function calendarText(value: string) {
    return value
        .replaceAll("\\", "\\\\")
        .replaceAll("\n", "\\n")
        .replaceAll(",", "\\,")
        .replaceAll(";", "\\;")
        .replaceAll("\r", "");
}

/** Format a UTC timestamp for a calendar property. */
function calendarTime(value: number) {
    return new Date(value)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
}
