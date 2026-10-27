/** Rank answers by percentage, then count and name, without mutating the input. */
export function rankAnswers<T extends { label: string; count?: number; percentage: number }>(
    groups: readonly T[],
): T[] {
    return [...groups].sort(
        (left, right) =>
            right.percentage - left.percentage ||
            (right.count !== undefined && left.count !== undefined
                ? right.count - left.count
                : 0) ||
            left.label.localeCompare(right.label, "en"),
    );
}
