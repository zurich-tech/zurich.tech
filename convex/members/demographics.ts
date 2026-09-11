import { v, type Infer } from "convex/values";

/** Optional categories used only for community statistics. */
export const demographics = v.object({
    age: v.optional(
        v.union(
            v.literal("under18"),
            v.literal("18–24"),
            v.literal("25–34"),
            v.literal("35–44"),
            v.literal("45–54"),
            v.literal("55–64"),
            v.literal("65+"),
        ),
    ),
    occupation: v.optional(
        v.union(
            v.literal("student"),
            v.literal("researcher"),
            v.literal("engineer"),
            v.literal("founder"),
            v.literal("manager"),
            v.literal("other"),
            v.literal("notWorking"),
        ),
    ),
    education: v.optional(
        v.union(
            v.literal("secondary"),
            v.literal("vocational"),
            v.literal("bachelor"),
            v.literal("master"),
            v.literal("doctorate"),
            v.literal("other"),
        ),
    ),
});

/** Private demographic answers. */
export type Demographics = Infer<typeof demographics>;

/** Human-readable choices shared by the survey and aggregate charts. */
export const demographicOptions = {
    age: [
        { value: "under18", label: "Under 18" },
        ...["18–24", "25–34", "35–44", "45–54", "55–64", "65+"].map((value) => ({
            value,
            label: value,
        })),
    ],
    occupation: [
        { value: "student", label: "Student" },
        { value: "researcher", label: "Researcher" },
        { value: "engineer", label: "Engineer / developer" },
        { value: "founder", label: "Founder / business owner" },
        { value: "manager", label: "Manager / executive" },
        { value: "notWorking", label: "Not currently working" },
        { value: "other", label: "Other" },
    ],
    education: [
        { value: "secondary", label: "Secondary school" },
        { value: "vocational", label: "Vocational training" },
        { value: "bachelor", label: "Bachelor’s degree" },
        { value: "master", label: "Master’s degree" },
        { value: "doctorate", label: "Doctorate" },
        { value: "other", label: "Other" },
    ],
};
