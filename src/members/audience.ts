/** Rank answers by count, breaking ties alphabetically without mutating the input. */
export function rankAnswers<T extends { label: string; count: number }>(groups: readonly T[]): T[] {
    return [...groups].sort(
        (left, right) => right.count - left.count || left.label.localeCompare(right.label, "en"),
    );
}
