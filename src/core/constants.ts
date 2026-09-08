/** Public site identity and stated community figures. */
export const site = {
    /** Canonical public name. */
    name: "zurich.tech",
    /** Canonical public origin. */
    url: "https://zurich.tech",
    /** Attendance threshold reached at most events. */
    attendees: 100,
    /** Annual event count exceeds this threshold. */
    eventsPerYear: 10,
    /** Lower bound for mailing list subscribers. */
    subscribers: 3500,
    /** Lower bound for community membership. */
    members: 3000,
} as const;

/** Calendar timezone used for Zürich events. */
export const timeZone = "Europe/Zurich";

/** Entries revealed on each calendar or jobs page. */
export const pageSize = 10;
