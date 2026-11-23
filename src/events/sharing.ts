/** Published details used by sharing images, without registration or private venue records. */
export type SharedEvent = {
    title: string;
    startsAt: number;
    status: string;
    speakers: {
        id: string;
        name: string;
        affiliations?: { organisation: string; role: string }[];
        imageUrl?: string;
    }[];
    sessions: { speakerIds: string[] }[];
};

/** Keep a stable image URL independent of gallery photos. */
export function eventImage(slug: string) {
    return `/og/events/${encodeURIComponent(slug)}.png`;
}

/** Group co-speakers in programme order and include unassigned speakers once. */
export function speakerGroups(event: SharedEvent) {
    const speakers = new Map(event.speakers.map((speaker) => [speaker.id, speaker]));
    const included = new Set<string>();
    const groups: SharedEvent["speakers"][] = [];

    // repeated appearances do not repeat a person on the sharing image
    for (const session of event.sessions) {
        const group: SharedEvent["speakers"] = [];
        for (const id of session.speakerIds) {
            const speaker = speakers.get(id);
            if (!speaker) throw new Error("programme speaker is missing");
            if (!included.has(id)) group.push(speaker);
            included.add(id);
        }
        if (group.length) groups.push(group);
    }
    for (const speaker of event.speakers) {
        if (!included.has(speaker.id)) groups.push([speaker]);
    }

    return groups;
}

/** Include the year and format the time in Zurich, independently of the server timezone. */
export function imageDate(startsAt: number) {
    const date = new Date(startsAt);
    const day = date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Zurich",
    });
    const time = date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Zurich",
    });

    return `${day} · ${time}`;
}
