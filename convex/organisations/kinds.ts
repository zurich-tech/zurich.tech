import { v } from "convex/values";

/** Public organisation categories shared by storage, editing and discovery. */
export const organisationKinds = {
    startup: "Startup",
    company: "Company",
    university: "University",
    lab: "Lab",
    community: "Community",
    space: "Space",
} as const;

export type OrganisationKind = keyof typeof organisationKinds;
export const organisationKind = v.union(
    v.literal("startup"),
    v.literal("company"),
    v.literal("university"),
    v.literal("lab"),
    v.literal("community"),
    v.literal("space"),
);
