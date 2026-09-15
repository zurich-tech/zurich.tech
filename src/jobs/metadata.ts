import type { Job } from "./queries";
import { renderMarkdown } from "../components/markdown";

/** Describe the visible vacancy without inferring undisclosed employment terms. */
export function jobMetadata(job: Job) {
    const salary = job.compensation?.salary;
    const employmentType =
        job.engagement === "internship"
            ? "INTERN"
            : job.engagement === "freelance"
              ? "CONTRACTOR"
              : job.workload?.min === 100
                ? "FULL_TIME"
                : job.workload?.max !== undefined && job.workload.max < 100
                  ? "PART_TIME"
                  : undefined;

    return {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: job.title,
        description: renderMarkdown(`${job.summary}\n\n${job.description}`),
        datePosted: new Date(job.publishedAt).toISOString(),
        validThrough: job.applicationDeadline
            ? new Date(job.applicationDeadline).toISOString()
            : undefined,
        hiringOrganization: {
            "@type": "Organization",
            name: job.company.name,
            sameAs: job.company.website,
            logo: job.company.logoUrl,
        },
        jobLocation: job.locations.map((location) => ({
            "@type": "Place",
            address: {
                "@type": "PostalAddress",
                addressLocality: location.locality,
                addressCountry: location.countryCode,
            },
        })),
        jobLocationType: job.workplace === "remote" ? "TELECOMMUTE" : undefined,
        employmentType,
        // only describe actual offered pay; full-time equivalents may differ from compensation
        baseSalary:
            salary && (salary.basis === "workload" || job.workload?.min === 100)
                ? {
                      "@type": "MonetaryAmount",
                      currency: salary.currency,
                      value: {
                          "@type": "QuantitativeValue",
                          minValue: salary.amount.min,
                          maxValue: salary.amount.max,
                          unitText: salary.period.toUpperCase(),
                      },
                  }
                : undefined,
    };
}
