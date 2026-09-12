/** Annual community sponsorship options, shared with the public page. */
export const tiers = [
    {
        id: "gold",
        name: "Gold",
        logoWidth: 180,
        map: "Large logo on the map",
        price: 5000,
        purpose: "Become an integral partner.",
        contribution: "Help shape what comes next.",
        jobs: null,
        description: "Largest linked logo, first row",
        newsletter: "Largest logo, first row",
        slides: "Largest logo, first row",
        banner: "Largest logo, first row",
        news: { title: "Partner news", description: "Occasional sharing of partner news" },
        events: "One jointly organised event per year",
    },
    {
        id: "silver",
        name: "Silver",
        logoWidth: 110,
        map: "Medium logo on the map",
        price: 2000,
        purpose: "Make more events possible.",
        contribution: "Help cover venues, food and equipment.",
        jobs: 10,
        description: "Medium linked logo",
        newsletter: "Logo in the sponsor footer",
        slides: "Logo on opening slides",
        banner: "Medium logo on our shared banner",
        news: { title: "Industry news", description: "Occasional sharing of relevant updates" },
        events: undefined,
    },
    {
        id: "bronze",
        name: "Bronze",
        logoWidth: 80,
        map: "Small logo on the map",
        price: 1000,
        purpose: "Support the local community.",
        contribution: "Help keep things running.",
        jobs: 5,
        description: "Small linked logo",
        newsletter: "Logo in the sponsor footer",
        slides: "Logo on opening slides",
        banner: "Small logo on our shared banner",
        news: undefined,
        events: undefined,
    },
] as const;

/** Annual personal support options. */
export const personalTiers = [
    {
        id: "friend",
        name: "Friend",
        price: 20,
        avatarSize: 36,
        purpose: "Express your friendship.",
        contribution: "Be part of something local.",
        recognition: "Linked avatar on the sponsor wall",
    },
    {
        id: "patron",
        name: "Patron",
        price: 200,
        avatarSize: 52,
        purpose: "Keep the community thriving.",
        contribution: "Make room for more ideas and connections.",
        recognition: "Larger linked avatar or logo on the sponsor wall",
    },
] as const;

/** Price of one job listing in CHF. */
export const jobPrice = 100;

/** Paid job listing duration in calendar months. */
export const jobDurationMonths = 6;
