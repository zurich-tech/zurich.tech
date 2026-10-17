import { workplaces, engagements } from "./labels";
import { countries } from "../members/countries";
import type { Job } from "./fields";

/** Format open, closed and exact ranges without inventing an endpoint. */
export function rangeLabel(range: { min?: number; max?: number }): string {
    const format = (value: number) =>
        new Intl.NumberFormat("de-CH", { maximumFractionDigits: 4 }).format(value);
    if (range.min === undefined) return `Up to ${format(range.max!)}`;
    if (range.max === undefined) return `From ${format(range.min)}`;
    return range.min === range.max
        ? format(range.min)
        : `${format(range.min)}–${format(range.max)}`;
}

/** Preserve the employer's currency, pay period and workload basis. */
export function salaryLabel(
    salary: NonNullable<NonNullable<Job["compensation"]>["salary"]>,
): string {
    return `${salary.currency} ${rangeLabel(salary.amount)} / ${salary.period}${salary.basis === "full-time" ? " (100%)" : ""}`;
}

/** Build the employer's selected application destination. */
export function applicationHref(application: Job["application"]): string {
    return application.kind === "url"
        ? application.url
        : `mailto:${application.email}${application.subject ? `?subject=${encodeURIComponent(application.subject)}` : ""}`;
}

/** Display structured workplaces without requiring a street address. */
export function locationsLabel(locations: Job["locations"]): string {
    return locations
        .map(
            (location) =>
                `${location.locality}, ${countries.find((country) => country.value === location.countryCode)?.label ?? location.countryCode}`,
        )
        .join(" / ");
}

/** Keep decision-making job facts identical in cards, details and email. */
export function jobFacts(
    job: Pick<Job, "workplace" | "engagement" | "workload" | "compensation">,
): string[] {
    return [
        workplaces[job.workplace],
        engagements[job.engagement],
        job.workload ? `${rangeLabel(job.workload)}%` : undefined,
        job.compensation?.salary ? `${salaryLabel(job.compensation.salary)} gross` : undefined,
        job.compensation?.equity ? `${rangeLabel(job.compensation.equity)}% equity` : undefined,
    ].filter((value): value is string => value !== undefined);
}
