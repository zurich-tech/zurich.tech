import { query } from "../_generated/server";
import { aggregateAudience } from "../members/audience";
import { surveyTitles } from "../members/demographics";
import type { SurveyQuestion } from "../members/demographics";

/** Switzerland and its five neighbouring countries, by ISO country code. */
const regionalCountries = new Set(["CH", "DE", "FR", "IT", "AT", "LI"]);

/** Publish aggregate percentages, excluding account details and absolute response counts. */
export const community = query({
    args: {},
    handler: async (ctx) => {
        // reuse option exposure calculations across public and administrator results
        const accounts = (await ctx.db.query("accounts").collect()).filter(
            (account) =>
                account.status === "active" &&
                regionalCountries.has(account.demographics?.residence ?? ""),
        );
        const report = await aggregateAudience(ctx, accounts);

        return report.questions.map((question) => ({
            field: question.field,
            label: surveyTitles[question.field as SurveyQuestion],
            groups: question.groups.map((group) => ({
                label: group.label,
                percentage: group.percentage,
                hasResponses: group.count > 0,
                hasUnreviewed: group.unreviewed > 0,
                isEstimated: group.inferred > 0,
            })),
        }));
    },
});
