/** Annual community sponsorship options, shared with the public page. */
export const tiers = [
    {
        id: "partner",
        name: "Partner",
        logoWidth: 180,
        map: "Large logo on the map",
        price: 2500,
        purpose: "Become an integral partner.",
        contribution: "Help shape what comes next.",
        jobs: 10,
        description: "Largest linked logo, first row",
        newsletter: "Largest logo, first row",
        slides: "Largest logo, first row",
        banner: "Largest logo, first row",
        news: { title: "Partner news", description: "Occasional sharing of partner news" },
        events: "Collaborate on partner events",
    },
    {
        id: "champion",
        name: "Champion",
        logoWidth: 110,
        map: "Medium logo on the map",
        price: 1000,
        purpose: "Make more events possible.",
        contribution: "Help cover venues, food and equipment.",
        jobs: 5,
        description: "Medium linked logo",
        newsletter: "Logo in the sponsor footer",
        slides: "Logo on opening slides",
        banner: "Medium logo on our shared banner",
        news: { title: "Industry news", description: "Occasional sharing of relevant updates" },
        events: undefined,
    },
    {
        id: "friend",
        name: "Friend",
        logoWidth: 80,
        map: "Small logo on the map",
        price: 250,
        purpose: "Support the local community.",
        contribution: "Help keep things running.",
        jobs: 2,
        description: "Small linked logo",
        newsletter: undefined,
        slides: undefined,
        banner: "Small logo on our shared banner",
        news: undefined,
        events: undefined,
    },
] as const;

/** Annual personal support option. */
export const patron = {
    price: 20,
    purpose: "Help keep things running.",
    contribution: "A small contribution to shared costs.",
} as const;

/** Price of one job listing in CHF. */
export const jobPrice = 50;

/** Paid job listing duration in calendar months. */
export const jobDurationMonths = 6;
