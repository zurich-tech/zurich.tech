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
    const terms = fold(query)
        .trim()
        .split(/\s+/)
        .map((term) => term.replace(/^#+/, ""))
        .filter(Boolean);

    return [...new Set(terms)];
}

/** Return whether searchable text contains every term. */
export function matchesSearch(text: string, terms: readonly string[]): boolean {
    const normalized = fold(text);

    return terms.every((term) => normalized.includes(term));
}

/** Rank an item against every term, or reject it with a negative score. */
export function searchScore(item: SearchItem, terms: readonly string[]): number {
    return scoreFields(
        { label: fold(item.label), context: fold(item.context), text: fold(item.text) },
        terms,
    );
}

/** Score already-normalized fields without allocating another copy of long descriptions. */
function scoreFields(
    { label, context, text }: { label: string; context: string; text: string },
    terms: readonly string[],
) {
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

    const normalized = text
        .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/<[^>]*>/g, " ")
        .replace(/[*_`#]+/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const positions = terms
        .map((term) => fold(normalized).indexOf(term))
        .filter((position) => position >= 0);
    const match = positions.length ? Math.min(...positions) : 0;
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

    const matched = new Set<number>();
    const positions: number[] = [];
    let normalized = "";
    let offset = 0;

    // Retain original offsets when normalization removes accents or changes character length.
    for (const character of text) {
        const value = fold(character);
        for (let index = 0; index < value.length; index++) positions.push(offset);
        normalized += value;
        offset += character.length;
    }
    for (const raw of terms) {
        const term = fold(raw);
        if (!term) continue;
        let index = normalized.indexOf(term);
        while (index >= 0) {
            const start = positions[index];
            const end = positions[index + term.length] ?? text.length;
            for (let position = start; position < end; position++) matched.add(position);
            index = normalized.indexOf(term, index + 1);
        }
    }

    // Merge overlapping matches and preserve the original text verbatim.
    const parts: HighlightPart[] = [];
    for (let index = 0; index < text.length; index++) {
        const isMatch = matched.has(index);
        const last = parts.at(-1);
        if (last?.isMatch === isMatch) last.text += text[index];
        else parts.push({ isMatch, text: text[index] });
    }
    return parts;
}

/** Match accents consistently without rewriting displayed names. */
export function fold(text: string) {
    return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Shared visible content supplied by each searchable model. */
export const searchKinds = ["Events", "Series", "People", "News", "Jobs", "Organisations"] as const;
export type SearchKind = (typeof searchKinds)[number];

export type SearchRecord = {
    label: string;
    description: string;
    href: string;
    kind: string;
    startsAt?: number;
    status?: string;
    detail?: string;
    image?: string;
};

/** Match, rank and highlight a record using exactly the same normalized terms. */
export function matchRecord<T extends SearchRecord>(record: T, terms: readonly string[]) {
    const score = searchScore(
        { label: record.label, text: record.description, context: record.kind },
        terms,
    );
    if (score < 0) return null;
    const description = searchExcerpt(record.description, terms);
    return {
        ...record,
        score,
        description,
        labelParts: highlightParts(record.label, terms),
        descriptionParts: highlightParts(description, terms),
    };
}

/** Normalize large text fields once per catalogue update, not once per keystroke. */
export function indexRecords(records: readonly SearchRecord[]) {
    return records.map((record) => ({
        record,
        label: fold(record.label),
        context: fold(record.kind),
        text: fold(record.description),
    }));
}

/** Rank in memory and highlight only the visible results. */
export function searchRecords(
    index: ReturnType<typeof indexRecords>,
    text: string,
    kind?: SearchKind,
    limit = 5,
    now = Date.now(),
) {
    const terms = searchTerms(text);
    if (!terms.length) return [];
    const counts = new Map<string, number>();
    return index
        .filter((item) => !kind || item.record.kind === kind)
        .map((item) => ({
            item,
            score: scoreFields(
                {
                    ...item,
                    context: `${item.context} ${item.record.startsAt !== undefined ? (item.record.startsAt >= now ? "upcoming" : "past") : ""}`,
                },
                terms,
            ),
        }))
        .filter((item) => item.score >= 0)
        .sort((a, b) => b.score - a.score || a.item.record.label.localeCompare(b.item.record.label))
        .filter(({ item }) => {
            const count = counts.get(item.record.kind) ?? 0;
            counts.set(item.record.kind, count + 1);
            return count < limit;
        })
        .map(({ item, score }) => {
            const description = searchExcerpt(item.record.description, terms);
            return {
                ...item.record,
                score,
                description,
                labelParts: highlightParts(item.record.label, terms),
                descriptionParts: highlightParts(description, terms),
            };
        });
}
