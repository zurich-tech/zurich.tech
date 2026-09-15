import { countries } from "../members/countries";
import type { Job } from "./fields";
import { normalizeEmail } from "../members/emails";
import { normalizeUrl } from "../members/urls";

/** Validate and normalize a complete authored vacancy before storing it. */
export function normalizeJob(job: Job): Job {
    // bound copy and require enough information to understand the role
    if (
        !job.title.trim() ||
        job.title.length > 180 ||
        !job.summary.trim() ||
        job.summary.length > 300 ||
        !job.description.trim() ||
        job.description.length > 50000 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(job.slug)
    )
        throw new Error("Enter a title, short summary, description and valid URL slug.");
    const list = (values: string[], limit: number, length: number) => {
        const result = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
        if (result.length > limit || result.some((value) => value.length > length))
            throw new Error("Too many or excessively long job details.");
        return result;
    };
    const locations = job.locations.map((location) => ({
        locality: location.locality.trim(),
        countryCode: location.countryCode,
    }));
    if (
        locations.length > 10 ||
        locations.some(
            (location) =>
                !location.locality ||
                location.locality.length > 200 ||
                !countries.some((country) => country.value === location.countryCode),
        )
    )
        throw new Error("Enter valid cities and countries.");
    if (job.workplace !== "remote" && !locations.length)
        throw new Error("Enter at least one workplace location.");
    if (job.remoteEligibility && (job.workplace === "onsite" || job.remoteEligibility.length > 300))
        throw new Error(
            "Remote eligibility requires a hybrid or remote role and at most 300 characters.",
        );

    // validate quantities without treating an omitted bound as zero
    validateRange(job.workload, "workload", 100, true);
    validateRange(job.compensation?.equity, "equity", 100);
    const salary = job.compensation?.salary;
    if (salary) {
        validateRange(salary.amount, "salary");
        if (!Intl.supportedValuesOf("currency").includes(salary.currency))
            throw new Error("Select a supported salary currency.");
    }
    if (job.compensation && !salary && !job.compensation.equity)
        throw new Error("Enter salary or equity, or omit compensation.");
    if (
        job.duration?.kind === "fixed" &&
        job.duration.months !== undefined &&
        (!Number.isInteger(job.duration.months) ||
            job.duration.months < 1 ||
            job.duration.months > 120)
    )
        throw new Error("Enter a duration between 1 and 120 months.");
    if (job.applicationDeadline !== undefined && !Number.isFinite(job.applicationDeadline))
        throw new Error("Enter a valid application deadline.");
    if (
        job.application.kind === "email" &&
        ((job.application.subject?.length ?? 0) > 200 ||
            /[\r\n]/.test(job.application.subject ?? ""))
    )
        throw new Error("Enter a short, single-line email subject.");

    return {
        ...job,
        title: job.title.trim(),
        summary: job.summary.trim(),
        description: job.description.trim(),
        locations,
        topics: list(job.topics, 12, 80),
        skills: list(job.skills, 20, 60),
        languages: list(job.languages, 12, 60),
        remoteEligibility: job.remoteEligibility?.trim() || undefined,
        application:
            job.application.kind === "url"
                ? { kind: "url", url: normalizeUrl(job.application.url) }
                : {
                      kind: "email",
                      email: normalizeEmail(job.application.email),
                      subject: job.application.subject?.trim() || undefined,
                  },
    };
}

/** Require at least one finite, ordered endpoint in the quantity's domain. */
function validateRange(
    range: { min?: number; max?: number } | undefined,
    label: string,
    ceiling = Infinity,
    isPositive = false,
) {
    if (!range) return;
    const values = [range.min, range.max].filter((value): value is number => value !== undefined);
    if (
        !values.length ||
        values.some(
            (value) =>
                !Number.isFinite(value) ||
                value < 0 ||
                value > ceiling ||
                (isPositive && value === 0),
        ) ||
        (range.min !== undefined && range.max !== undefined && range.min > range.max)
    )
        throw new Error(`Enter a valid ${label} range.`);
}
