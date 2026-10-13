/** Public site identity and stated community figures. */
export const site = {
    /** Canonical public name. */
    name: "zurich.tech",
    /** Public contact for the association, events and sponsorships. */
    email: "florian@zurich.tech",
    /** Shared homepage and social sharing description. */
    description: "zurich.tech is a volunteer-run non-profit growing the local tech community.",
    /** Community accounts and public invitation. */
    socials: {
        linkedin: "https://www.linkedin.com/company/zurichai/",
        x: "https://x.com/zurichnlp",
        discord: "https://discord.gg/373R4C3872",
    },
    /** Canonical public origin. */
    url: "https://zurich.tech",
    /** Attendance threshold reached at most events. */
    attendees: 100,
    /** Annual event count exceeds this threshold. */
    eventsPerYear: 10,
    /** Lower bound for community membership. */
    members: 3000,
    /** Registration totals below this stay visible to organisers only. */
    publicRegistrations: 50,
} as const;

/** Calendar timezone used for Zurich events. */
export const timeZone = "Europe/Zurich";

/** Entries revealed on each calendar or jobs page. */
export const pageSize = 10;
