import { pageSize } from "../../core/constants";
import { getJobs } from "../../core/queries";

import { createAsync } from "@solidjs/router";
import { createSignal, createMemo, createEffect, on, For, Show } from "solid-js";

import { Arrow } from "../../component/arrow";
import { Card } from "../../component/card";
import { Page } from "../../component/page";
import { Seo } from "../../component/seo";
import { JobEntry } from "../../component/job";
import { workplaces, employments } from "../../../shared/jobs";
import { jobPrice, jobDurationMonths } from "../../../shared/plans";

/** Browse current, reviewed local vacancies. */
export default function Route() {
    // load approved jobs and retain the selected filters
    const jobs = createAsync(() => getJobs(), { deferStream: true });
    const [search, setSearch] = createSignal("");
    const [workplace, setWorkplace] = createSignal("all");
    const [employment, setEmployment] = createSignal("all");
    const [count, setCount] = createSignal(pageSize);

    // match location, contract and search terms
    const matches = createMemo(() =>
        (jobs() ?? []).filter(
            (job) =>
                (workplace() === "all" || job.workplace === workplace()) &&
                (employment() === "all" || job.employment === employment()) &&
                `${job.title} ${job.company.name} ${job.location} ${job.tags.join(" ")}`
                    .toLowerCase()
                    .includes(search().trim().toLowerCase()),
        ),
    );

    // restart pagination when the matching vacancies change
    createEffect(on(matches, () => setCount(pageSize)));

    return (
        <>
            <Seo
                title="Jobs"
                description="Tech jobs in Zürich. Browse roles, salaries and remote options from local companies."
            />
            <Page>
                <div class="listing-layout">
                    <Card title="Jobs" heading="h1" meta={matches().length} class="listing-card">
                        {/* filter the published vacancies */}
                        <div class="listing-filters">
                            <input
                                aria-label="Search jobs"
                                placeholder="Role, company or technology"
                                value={search()}
                                onInput={(event) => setSearch(event.currentTarget.value)}
                            />
                            <select
                                aria-label="Workplace"
                                value={workplace()}
                                onChange={(event) => setWorkplace(event.currentTarget.value)}
                            >
                                <option value="all">All locations</option>
                                <For each={Object.entries(workplaces)}>
                                    {([value, label]) => <option value={value}>{label}</option>}
                                </For>
                            </select>
                            <select
                                aria-label="Employment"
                                value={employment()}
                                onChange={(event) => setEmployment(event.currentTarget.value)}
                            >
                                <option value="all">All contracts</option>
                                <For each={Object.entries(employments)}>
                                    {([value, label]) => <option value={value}>{label}</option>}
                                </For>
                            </select>
                        </div>
                        {/* render the visible page of matching jobs */}
                        <For each={matches().slice(0, count())}>
                            {(job) => <JobEntry job={job} />}
                        </For>
                        <Show when={jobs() && matches().length === 0}>
                            <p class="empty-copy">
                                {jobs()!.length
                                    ? "No jobs match these filters."
                                    : "No open roles listed yet."}
                            </p>
                        </Show>
                        <Show when={matches().length > count()}>
                            <div class="programme-more">
                                <button
                                    class="button"
                                    onClick={() => setCount((value) => value + pageSize)}
                                >
                                    Load more
                                </button>
                                <span>
                                    {count()} of {matches().length}
                                </span>
                            </div>
                        </Show>
                    </Card>
                    {/* show the listing price and employer actions */}
                    <aside class="listing-sidebar">
                        <Card title="Hiring?" class="offer-card">
                            <p class="tier-price">
                                <span>CHF</span> {jobPrice}
                                <span>/ listing · {jobDurationMonths} months</span>
                            </p>
                            <a class="button button--primary" href="/jobs/submit">
                                Post a job
                            </a>
                            <ul class="plan-benefits">
                                <li>
                                    <Arrow />
                                    <strong>Highlighted in newsletter emails</strong>
                                </li>
                                <li>
                                    <Arrow />
                                    <strong>Shown at events</strong>
                                </li>
                                <li>
                                    <Arrow />
                                    <strong>Applications go directly to your hiring site</strong>
                                </li>
                            </ul>
                            <a class="text-link" href="/manage">
                                Manage your listings
                            </a>
                        </Card>
                    </aside>
                </div>
            </Page>
        </>
    );
}
