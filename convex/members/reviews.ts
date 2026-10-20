import { ConvexError, v, type Infer } from "convex/values";
import {
    surveyAnswer,
    surveyLabels,
    surveyQuestions,
    surveyQuestion,
    demographicOptions,
    motivationOptions,
    participationOptions,
    type CommunityAnswers,
    type SurveyQuestion,
} from "./demographics";
import { allLanguages } from "./languages";
import { countries } from "./countries";

/** The question and choices available when an answer was explicitly saved. */
export const reviewInput = v.object({
    question: surveyQuestion,
    wording: v.string(),
    options: v.array(v.string()),
});
/** Historical inferences have no invented review timestamp. */
export const surveyReview = v.object({
    question: surveyQuestion,
    wording: v.string(),
    options: v.array(v.string()),
    source: v.union(v.literal("explicit"), v.literal("inferred")),
    at: v.optional(v.number()),
});
export type ReviewInput = Infer<typeof reviewInput>;
export type SurveyReview = Infer<typeof surveyReview>;

/** Original option sets reconstructed from the commits that introduced each question. */
const original: Partial<Record<SurveyQuestion, readonly string[]>> = {
    interests: [
        "robotics",
        "reinforcement-learning",
        "nlp",
        "computer-vision",
        "agents",
        "hardware",
        "software-engineering",
        "data-engineering",
        "graphics",
        "security",
        "ai-policy",
        "climate-tech",
        "biotech",
        "product-design",
        "startups",
    ],
    motivations: ["friends", "colleagues", "collaborators", "learning", "sharing", "opportunities"],
    participation: ["attend", "speak", "organise", "mentor", "sponsor"],
    roles: [
        "engineering",
        "research",
        "product",
        "design",
        "founding",
        "leadership",
        "investing",
        "business",
        "student",
        "other",
    ],
    education: ["secondary", "vocational", "bachelor", "master", "doctorate", "other"],
    languages: ["en", "de", "fr", "it", "es", "pt"],
    eventKinds: [
        "talks",
        "dinners",
        "demos",
        "reading-groups",
        "workshops",
        "excursions",
        "sports",
        "hikes",
        "hackathons",
        "meetups",
    ],
};

/** Deployment completion times, with the September role split approximated by its commit time. */
const additions: { question: SurveyQuestion; at: string; options: readonly string[] }[] = [
    { question: "roles", at: "2026-09-14T18:47:40Z", options: ["ownership", "consulting"] },
    { question: "roles", at: "2026-10-02T19:16:20Z", options: ["sales"] },
    { question: "participation", at: "2026-10-02T19:16:20Z", options: ["volunteer"] },
    {
        question: "languages",
        at: "2026-10-03T08:17:52Z",
        options: demographicOptions.languages.map((option) => option.value),
    },
    {
        question: "education",
        at: "2026-10-03T08:45:34Z",
        options: ["none", "compulsory", "upper-secondary", "professional"],
    },
    {
        question: "languages",
        at: "2026-10-13T18:15:08Z",
        options: allLanguages.map((option) => option.value),
    },
    { question: "interests", at: "2026-10-13T18:15:08Z", options: ["electronics"] },
    { question: "participation", at: "2026-10-16T12:40:30Z", options: ["demo", "host", "teach"] },
    { question: "interests", at: "2026-10-16T12:40:30Z", options: ["games"] },
    {
        question: "interests",
        at: "2026-10-16T14:39:50Z",
        options: ["quantum", "materials", "manufacturing", "space", "databases", "analytics"],
    },
    { question: "eventKinds", at: "2026-10-19T21:13:22Z", options: ["game-nights", "coworking"] },
    {
        question: "motivations",
        at: "2026-10-20T09:33:43Z",
        options: [
            "starting-company",
            "joining-startup",
            "cofounders",
            "hiring",
            "customers",
            "backing-startups",
        ],
    },
];

/** Return the complete static choice catalogue; interests come from the displayed topic catalogue. */
export function reviewOptions(question: SurveyQuestion): string[] {
    if (question === "interests") return [];
    if (question === "motivations") return motivationOptions.map((option) => option.value);
    if (question === "participation") return participationOptions.map((option) => option.value);
    if (question === "languages") return allLanguages.map((option) => option.value);
    if (question === "residence" || question === "citizenships")
        return countries.map((option) => option.value);

    return demographicOptions[question].map((option) => option.value);
}

/** Estimate historical availability from completion or account-update time, retaining its provenance. */
export function inferReviews(
    account: Partial<CommunityAnswers> & {
        surveyVisited?: SurveyQuestion[];
        surveyCompletedAt?: number;
        updatedAt?: number;
    },
): SurveyReview[] {
    const answers: CommunityAnswers = {
        demographics: account.demographics ?? {},
        interests: account.interests ?? [],
        motivations: account.motivations ?? [],
        participation: account.participation ?? [],
    };
    const at = account.surveyCompletedAt ?? account.updatedAt;

    return surveyQuestions.flatMap((question) => {
        const values = surveyAnswer(answers, question);
        const raw =
            question === "interests" || question === "motivations" || question === "participation"
                ? answers[question]
                : answers.demographics[question];
        if (!values.length && !account.surveyVisited?.includes(question) && raw !== null) return [];

        return [
            {
                question,
                wording:
                    question === "discovery" && (!at || at < Date.parse("2026-10-19T21:13:22Z"))
                        ? "How did you hear about zurich.tech?"
                        : surveyLabels[question],
                options: [
                    ...new Set([
                        ...(original[question] ?? reviewOptions(question)),
                        ...additions
                            .filter(
                                (change) =>
                                    change.question === question &&
                                    at !== undefined &&
                                    Date.parse(change.at) <= at,
                            )
                            .flatMap((change) => change.options),
                        ...values,
                    ]),
                ],
                source: "inferred" as const,
            },
        ];
    });
}

/** Replace only explicitly saved questions; stale clients never certify the server's latest catalogue. */
export function saveReviews(
    previous: SurveyReview[],
    inputs: ReviewInput[],
    at: number,
): SurveyReview[] {
    if (
        inputs.length > surveyQuestions.length ||
        new Set(inputs.map((input) => input.question)).size !== inputs.length
    )
        throw new ConvexError("review each question once");
    const saved = new Map(previous.map((review) => [review.question, review]));
    for (const input of inputs) {
        if (
            input.wording.length > 200 ||
            input.options.length > 512 ||
            input.options.some((option) => option.length > 100)
        )
            throw new ConvexError("survey review exceeds the allowed size");
        saved.set(input.question, {
            ...input,
            options: [...new Set(input.options)],
            source: "explicit",
            at,
        });
    }

    return [...saved.values()];
}

/** Detect changed wording or choices without treating removals and reordering as new questions. */
export function needsReview(review: SurveyReview | undefined, current: ReviewInput): boolean {
    return (
        !review ||
        review.wording !== current.wording ||
        current.options.some((option) => !review.options.includes(option))
    );
}
