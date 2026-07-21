/** One highlighted or plain text segment. */
export type HighlightPart = {
    /** Whether the segment matched a search term. */
    isMatch: boolean;
    /** The original text segment. */
    text: string;
};

/** One item that can be ranked by search. */
export type SearchItem = {
    /** The item category. */
    context: string;
    /** The primary visible text. */
    label: string;
    /** Additional searchable text. */
    text: string;
};

/** Normalize a query into unique lowercase terms. */
export function searchTerms(query: string): readonly string[] {
    const terms = query
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .map((term) => term.replace(/^#+/, ""))
        .filter(Boolean);

    return [...new Set(terms)];
}

/** Return whether searchable text contains every term. */
export function matchesSearch(text: string, terms: readonly string[]): boolean {
    const normalized = text.toLowerCase();

    return terms.every((term) => normalized.includes(term));
}

/** Rank an item against every term, or reject it with a negative score. */
export function searchScore(item: SearchItem, terms: readonly string[]): number {
    const label = item.label.toLowerCase();
    const context = item.context.toLowerCase();
    const text = item.text.toLowerCase();
    let score = 0;

    // require every term and reward its strongest field
    for (const term of terms) {
        if (!label.includes(term) && !context.includes(term) && !text.includes(term)) {
            return -1;
        }

        // exact label
        if (label === term) score += 1000;
        // label prefix
        else if (label.startsWith(term)) score += 500;
        // partial label
        else if (label.includes(term)) score += 250;
        // result category
        else if (context.includes(term)) score += 100;
        // supporting text
        else score += 10;
    }

    return score;
}

/** Extract a compact passage around the first matching term. */
export function searchExcerpt(text: string, terms: readonly string[]): string {
    if (text === "" || terms.length === 0) {
        return "";
    }

    const normalized = text.replace(/\s+/g, " ").trim();
    const match = normalized.toLowerCase().indexOf(terms[0]);
    const start = Math.max(0, match - 42);
    const end = Math.min(normalized.length, start + 132);
    const prefix = start === 0 ? "" : "...";
    const suffix = end === normalized.length ? "" : "...";

    return `${prefix}${normalized.slice(start, end)}${suffix}`;
}

/** Split text into matched and unmatched segments without changing its case. */
export function highlightParts(text: string, terms: readonly string[]): readonly HighlightPart[] {
    if (text === "" || terms.length === 0) {
        return [{ isMatch: false, text }];
    }

    const orderedTerms = [...new Set(terms.map((term) => term.toLowerCase()))]
        .filter(Boolean)
        .sort((left, right) => right.length - left.length);
    const normalized = text.toLowerCase();
    const parts: HighlightPart[] = [];
    let start = 0;
    let index = 0;

    // consume the earliest term at each character
    while (index < text.length) {
        const term = orderedTerms.find((candidate) => normalized.startsWith(candidate, index));
        if (term === undefined) {
            index += 1;
            continue;
        }

        if (start < index) {
            parts.push({ isMatch: false, text: text.slice(start, index) });
        }
        parts.push({ isMatch: true, text: text.slice(index, index + term.length) });
        index += term.length;
        start = index;
    }

    // retain trailing unmatched text
    if (start < text.length) {
        parts.push({ isMatch: false, text: text.slice(start) });
    }

    return parts;
}
