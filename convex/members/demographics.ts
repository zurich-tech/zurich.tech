import { countries } from "./countries";
import { languages } from "./languages";
import { ConvexError, v, type Infer } from "convex/values";

/** Stable survey choices shared by forms, validation and aggregate reports. */
export const demographicOptions = {
    eventsAttended: [
        { value: "0", label: "None yet" },
        { value: "1", label: "1" },
        { value: "2-3", label: "2–3" },
        { value: "4-6", label: "4–6" },
        { value: "7-10", label: "7–10" },
        { value: "11-20", label: "11–20" },
        { value: "21-50", label: "21–50" },
        { value: "51+", label: "51+" },
    ],
    eventFrequency: [
        { value: "never", label: "Never" },
        { value: "few-yearly", label: "A few times a year" },
        { value: "every-other-month", label: "Every other month" },
        { value: "monthly", label: "Once a month" },
        { value: "twice-monthly", label: "Twice a month" },
        { value: "weekly", label: "Weekly" },
        { value: "several-weekly", label: "Several times a week" },
        { value: "unsure", label: "Not sure yet" },
    ],
    // retain original annual answers without reinterpreting them as frequency choices
    eventsPerYear: [
        { value: "0", label: "None" },
        { value: "1-2", label: "1–2" },
        { value: "3-4", label: "3–4" },
        { value: "5-6", label: "5–6" },
        { value: "7-9", label: "7–9" },
        { value: "10-12", label: "10–12" },
        { value: "13-24", label: "13–24" },
        { value: "25+", label: "25+" },
    ],
    roles: [
        { value: "engineering", label: "Engineer" },
        { value: "research", label: "Researcher" },
        { value: "product", label: "Product" },
        { value: "design", label: "Designer" },
        { value: "founding", label: "Founder" },
        { value: "ownership", label: "Owner" },
        { value: "leadership", label: "Manager" },
        { value: "consulting", label: "Consultant" },
        { value: "investing", label: "Investor" },
        { value: "business", label: "Operations" },
        { value: "student", label: "Student" },
        { value: "sales", label: "Sales" },
        { value: "other", label: "Other" },
    ],
    languages,
    experience: [
        { value: "none", label: "Not started yet" },
        { value: "under2", label: "Under 2 years" },
        { value: "2–5", label: "2–5 years" },
        { value: "6–10", label: "6–10 years" },
        { value: "11–20", label: "11–20 years" },
        { value: "21+", label: "21+ years" },
    ],
    education: [
        { value: "none", label: "No formal qualification" },
        { value: "compulsory", label: "Compulsory schooling" },
        { value: "secondary", label: "Secondary school" },
        { value: "upper-secondary", label: "Upper-secondary school" },
        { value: "vocational", label: "Apprenticeship / vocational" },
        { value: "professional", label: "Higher vocational education" },
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
    eventsAttended: "How many zurich.tech events have you attended?",
    eventFrequency: "How often would you like to attend zurich.tech events?",
    eventsPerYear: "Events per year (previous question)",
    roles: "What do you do?",
    languages: "Which languages do you speak?",
    experience: "How long have you been working?",
    education: "Highest completed education",
    age: "How old are you?",
};
/** Reasons to join, independent of subjects and volunteering preferences. */
export const motivationOptions = [
    { value: "friends", label: "Meeting friends" },
    { value: "colleagues", label: "Meeting colleagues" },
    { value: "collaborators", label: "Finding collaborators" },
    { value: "learning", label: "Learning something" },
    { value: "sharing", label: "Sharing my work" },
    { value: "opportunities", label: "Finding opportunities" },
] as const;
export const participationOptions = [
    { value: "attend", label: "Attend" },
    { value: "speak", label: "Speak" },
    { value: "organise", label: "Organise" },
    { value: "mentor", label: "Mentor" },
    { value: "sponsor", label: "Sponsor" },
    { value: "volunteer", label: "Volunteer" },
] as const;

/** Unanswered fields are absent; null records an explicit decision not to answer. */
const choice = (options: readonly { value: string }[]) =>
    v.optional(v.union(v.null(), v.union(...options.map((option) => v.literal(option.value)))));
export const demographics = v.object({
    eventsAttended: choice(demographicOptions.eventsAttended),
    eventFrequency: choice(demographicOptions.eventFrequency),
    eventsPerYear: choice(demographicOptions.eventsPerYear),
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
        throw new ConvexError("Choose each professional role once from the available options.");

    if (
        value.languages &&
        (new Set(value.languages).size !== value.languages.length ||
            value.languages.some(
                (language) =>
                    !demographicOptions.languages.some((option) => option.value === language),
            ))
    )
        throw new ConvexError("Choose each language once from the available options.");

    // store country codes, never free-form locations or inferred citizenship
    const isCountry = (code: string) => countries.some((country) => country.value === code);
    if (value.residence != null && !isCountry(value.residence))
        throw new ConvexError("Choose your country of residence from the list.");
    if (
        value.citizenships &&
        (new Set(value.citizenships).size !== value.citizenships.length ||
            value.citizenships.some((code) => !isCountry(code)))
    )
        throw new ConvexError("Choose each country of citizenship once from the list.");
}
export function validateParticipation(values: string[]) {
    if (
        new Set(values).size !== values.length ||
        values.some((value) => !participationOptions.some((option) => option.value === value))
    )
        throw new ConvexError("Choose each way to participate once from the available options.");
}

/** Accept explicit motivations without inferring them from topic interests. */
export function validateMotivations(values: string[]) {
    if (
        new Set(values).size !== values.length ||
        values.some((value) => !motivationOptions.some((option) => option.value === value))
    )
        throw new ConvexError("Choose each reason once from the available options.");
}
