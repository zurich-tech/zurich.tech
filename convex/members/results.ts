/** Public percentages without respondent counts or identities. */
export type PercentageGroup = {
    label: string;
    percentage: number;
    hasResponses: boolean;
    hasUnreviewed: boolean;
    isEstimated: boolean;
};
