import { v } from "convex/values";

/** Public organisation categories shared by storage, editing and discovery. */
export const organisationKinds = {
    startup: "Startup",
    company: "Company",
    investor: "Investor",
    university: "University",
    lab: "Lab",
    community: "Community",
    nonprofit: "Non-profit",
    space: "Hub",
} as const;

export type OrganisationKind = keyof typeof organisationKinds;
export const organisationKind = v.union(
    v.literal("startup"),
    v.literal("company"),
    v.literal("investor"),
    v.literal("university"),
    v.literal("lab"),
    v.literal("community"),
    v.literal("nonprofit"),
    v.literal("space"),
);
