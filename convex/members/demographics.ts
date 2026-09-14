import { v, type Infer } from "convex/values";

/** Stable survey choices shared by forms, validation and aggregate reports. */
export const demographicOptions = {
    roles: [
        { value: "engineering", label: "Engineering" },
        { value: "research", label: "Research" },
        { value: "product", label: "Product" },
        { value: "design", label: "Design" },
        { value: "founding", label: "Founder / business owner" },
        { value: "leadership", label: "Management / leadership" },
        { value: "investing", label: "Investing" },
        { value: "business", label: "Business / operations" },
        { value: "student", label: "Student" },
        { value: "other", label: "Other" },
    ],
    experience: [
        { value: "none", label: "Not started yet" },
        { value: "under2", label: "Under 2 years" },
        { value: "2–5", label: "2–5 years" },
        { value: "6–10", label: "6–10 years" },
        { value: "11–20", label: "11–20 years" },
        { value: "21+", label: "21+ years" },
    ],
    education: [
        { value: "secondary", label: "Secondary school" },
        { value: "vocational", label: "Apprenticeship / vocational qualification" },
        { value: "bachelor", label: "Bachelor’s degree" },
        { value: "master", label: "Master’s degree" },
        { value: "doctorate", label: "Doctorate" },
        { value: "other", label: "Other" },
    ],
    age: [
        { value: "under18", label: "Under 18" },
        ...["18–24", "25–34", "35–44", "45–54", "55–64", "65+"].map((value) => ({
            value,
            label: value,
        })),
    ],
} as const;
export const demographicLabels = {
    roles: "What do you do?",
    experience: "Professional experience",
    education: "Highest completed education",
    age: "Age range",
};
export const participationOptions = [
    { value: "attend", label: "Attend" },
    { value: "speak", label: "Speak" },
    { value: "organise", label: "Organise" },
    { value: "mentor", label: "Mentor" },
    { value: "sponsor", label: "Sponsor" },
] as const;

/** Unanswered fields are absent; null records an explicit decision not to answer. */
const choice = (options: readonly { value: string }[]) =>
    v.optional(v.union(v.null(), v.union(...options.map((option) => v.literal(option.value)))));
export const demographics = v.object({
    roles: v.optional(v.union(v.null(), v.array(v.string()))),
    experience: choice(demographicOptions.experience),
    education: choice(demographicOptions.education),
    age: choice(demographicOptions.age),
});
export type Demographics = Infer<typeof demographics>;
export const participation = v.array(v.string());

/** Validate multi-select responses without treating absence as a negative answer. */
export function validateDemographics(value: Demographics) {
    if (
        value.roles &&
        (new Set(value.roles).size !== value.roles.length ||
            value.roles.some(
                (role) => !demographicOptions.roles.some((option) => option.value === role),
            ))
    )
        throw new Error("Choose each professional role once from the available options.");
}
export function validateParticipation(values: string[]) {
    if (
        new Set(values).size !== values.length ||
        values.some((value) => !participationOptions.some((option) => option.value === value))
    )
        throw new Error("Choose each way to participate once from the available options.");
}
