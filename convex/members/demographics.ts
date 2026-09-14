import { countries } from "./countries";
import { v, type Infer } from "convex/values";

/** Stable survey choices shared by forms, validation and aggregate reports. */
export const demographicOptions = {
    roles: [
        { value: "engineering", label: "Engineering" },
        { value: "research", label: "Research" },
        { value: "product", label: "Product" },
        { value: "design", label: "Design" },
        { value: "founding", label: "Founder" },
        { value: "ownership", label: "Business owner" },
        { value: "leadership", label: "Management" },
        { value: "consulting", label: "Consulting" },
        { value: "investing", label: "Investing" },
        { value: "business", label: "Business / operations" },
        { value: "student", label: "Student" },
        { value: "other", label: "Other" },
    ],
    languages: [
        { value: "en", label: "English" },
        { value: "de", label: "German" },
        { value: "fr", label: "French" },
        { value: "it", label: "Italian" },
        { value: "es", label: "Spanish" },
        { value: "pt", label: "Portuguese" },
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
    languages: "Which languages do you speak?",
    experience: "How long have you been working?",
    education: "What’s your education level?",
    age: "How old are you?",
};
/** Reasons to join, independent of subjects and volunteering preferences. */
export const motivationOptions = [
    { value: "friends", label: "Meeting friends" },
    { value: "colleagues", label: "Meeting colleagues" },
    { value: "collaborators", label: "Finding collaborators" },
    { value: "learning", label: "Learning something new" },
    { value: "sharing", label: "Sharing my work" },
    { value: "opportunities", label: "Finding opportunities" },
] as const;
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
    languages: v.optional(v.union(v.null(), v.array(v.string()))),
    experience: choice(demographicOptions.experience),
    education: choice(demographicOptions.education),
    age: choice(demographicOptions.age),
    residence: v.optional(v.union(v.null(), v.string())),
    citizenships: v.optional(v.union(v.null(), v.array(v.string()))),
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

    if (
        value.languages &&
        (new Set(value.languages).size !== value.languages.length ||
            value.languages.some(
                (language) =>
                    !demographicOptions.languages.some((option) => option.value === language),
            ))
    )
        throw new Error("Choose each language once from the available options.");

    // store country codes, never free-form locations or inferred citizenship
    const isCountry = (code: string) => countries.some((country) => country.value === code);
    if (value.residence != null && !isCountry(value.residence))
        throw new Error("Choose your country of residence from the list.");
    if (
        value.citizenships &&
        (new Set(value.citizenships).size !== value.citizenships.length ||
            value.citizenships.some((code) => !isCountry(code)))
    )
        throw new Error("Choose each country of citizenship once from the list.");
}
export function validateParticipation(values: string[]) {
    if (
        new Set(values).size !== values.length ||
        values.some((value) => !participationOptions.some((option) => option.value === value))
    )
        throw new Error("Choose each way to participate once from the available options.");
}

/** Accept explicit motivations without inferring them from topic interests. */
export function validateMotivations(values: string[]) {
    if (
        new Set(values).size !== values.length ||
        values.some((value) => !motivationOptions.some((option) => option.value === value))
    )
        throw new Error("Choose each reason once from the available options.");
}
