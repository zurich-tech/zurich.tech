import { expect, test } from "bun:test";
import { selectJobs } from "../convex/jobs/selection";

test("show each company before second listings without changing publication order", () => {
    const jobs = ["a", "a", "a", "b", "b", "c"].map((slug, index) => ({
        company: { slug },
        index,
    }));

    expect(selectJobs(jobs).map((job) => job.index)).toEqual([0, 3, 5, 1]);
    expect(jobs.map((job) => job.index)).toEqual([0, 1, 2, 3, 4, 5]);
});

test("limit previews to four jobs and two per company", () => {
    const jobs = ["a", "a", "a", "b", "b", "c", "d", "e"].map((slug) => ({
        company: { slug },
    }));

    expect(selectJobs(jobs).map((job) => job.company.slug)).toEqual(["a", "b", "c", "d"]);
    expect(selectJobs(jobs.slice(0, 5)).map((job) => job.company.slug)).toEqual([
        "a",
        "b",
        "a",
        "b",
    ]);
    expect(selectJobs(jobs.slice(0, 3))).toHaveLength(2);
    expect(selectJobs(jobs.slice(0, 1))).toHaveLength(1);
    expect(selectJobs([])).toEqual([]);
});
