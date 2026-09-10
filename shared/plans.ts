/** Annual community sponsorship options, shared with the public page. */
export const tiers = [
    {
        id: "principal",
        name: "Principal",
        logoWidth: 180,
        map: "Large logo on the community map",
        price: 2500,
        purpose: "Become an integral partner.",
        contribution: "Support the basics and what comes next.",
        jobs: 10,
        description: "Largest logo, first row",
        newsletter: "Largest logo, first row",
        slides: "Largest logo, first row",
        banner: "Largest logo, first row",
        news: "Occasional sharing of relevant updates",
    },
    {
        id: "partner",
        name: "Partner",
        logoWidth: 110,
        map: "Medium logo on the community map",
        price: 1000,
        purpose: "Enable more events to happen.",
        contribution: "Help cover core operating expenses.",
        jobs: 5,
        description: "Medium linked logo",
        newsletter: "Logo in the sponsor footer",
        slides: "Logo on opening slides",
        banner: "Medium logo on our shared banner",
        news: "Occasional sharing of relevant updates",
    },
    {
        id: "supporter",
        name: "Supporter",
        logoWidth: 80,
        map: "Small logo on the community map",
        price: 500,
        purpose: "Support the local community.",
        contribution: "Contribute to day-to-day running costs.",
        jobs: 2,
        description: "Small linked logo",
        newsletter: undefined,
        slides: undefined,
        banner: "Small logo on our shared banner",
        news: undefined,
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
export const jobDurationMonths = 3;
