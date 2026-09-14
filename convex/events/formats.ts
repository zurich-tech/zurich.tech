import { v } from "convex/values";

/** Describe the activity, independently from series, subject and registration. */
export const formats = [
    { value: "talk", label: "Talk" },
    { value: "discussion", label: "Discussion" },
    { value: "demo", label: "Demo" },
    { value: "workshop", label: "Workshop" },
    { value: "hackathon", label: "Hackathon" },
    { value: "dinner", label: "Dinner" },
    { value: "social", label: "Social" },
] as const;
export const format = v.union(...formats.map((option) => v.literal(option.value)));
