/** Select four newest-first jobs, showing each company before its second listing. */
export function selectJobs<Job extends { company: { slug: string } }>(jobs: readonly Job[]): Job[] {
    // retain at most two candidates per company in publication order
    const companies = new Set<string>();
    const first: Job[] = [];
    const second: Job[] = [];
    const repeated = new Set<string>();
    for (const job of jobs) {
        const company = job.company.slug;
        if (!companies.has(company)) {
            companies.add(company);
            first.push(job);
        } else if (!repeated.has(company)) {
            repeated.add(company);
            second.push(job);
        }
        if (first.length === 4) break;
    }

    return first.concat(second).slice(0, 4);
}
