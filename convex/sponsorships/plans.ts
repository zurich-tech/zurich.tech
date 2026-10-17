/** Annual sponsorship prices and benefits shared by billing and public pages. */
export const tiers = [
    {
        id: "gold",
        name: "Gold",
        logoWidth: 180,
        map: "Large logo on the map",
        price: 5000,
        purpose: "Help us plan events throughout the year.",
        jobs: null,
        description: "Largest linked logo, first row",
        newsletter: "Largest logo, first row",
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
        purpose: "Help us run more events.",
        jobs: 5,
        description: "Medium linked logo",
        newsletter: "Logo in the sponsor footer",
        banner: "Medium logo on our shared banner",
        news: { title: "Industry news", description: "Occasional sharing of relevant updates" },
        events: undefined,
    },
    {
        id: "bronze",
        name: "Bronze",
        logoWidth: 80,
        map: "Small logo on the map",
        price: 500,
        purpose: "Help cover our event costs.",
        jobs: 2,
        description: "Small linked logo",
        newsletter: "Logo in the sponsor footer",
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
        recognition: "Linked avatar on the sponsor wall",
    },
] as const;

/** Price of one job listing in CHF. */
export const jobPrice = 50;

/** Paid job listing duration in days. */
export const jobDurationDays = 90;
