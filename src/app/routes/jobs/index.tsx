import { useSearch } from "../../../search/local";
import { matchesSearch } from "../../../search/search";
import { EditLink } from "../../../auth/edit";
import { pageSize } from "../../site";
import { getJobs } from "../../../jobs/queries";

import { createAsync } from "@solidjs/router";
import { createSignal, createMemo, createEffect, on, For, Show } from "solid-js";

import { Arrow } from "../../../components/arrow";
import { FilterPills } from "../../../components/filter-pills";
import { Card } from "../../../components/card";
import { Page } from "../../page";
import { Seo } from "../../seo";
import { JobEntry } from "../../../jobs/job";
import { workplaces, employments } from "../../../jobs/filters";
import { jobPrice, jobDurationMonths } from "../../../sponsorships/plans";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => getJobs(),
};

/** Browse current, reviewed local vacancies. */
export default function Route() {
    // load approved jobs and retain the selected filters
    const jobs = createAsync(() => getJobs(), { deferStream: true });
    const { query: search, setQuery: setSearch, terms } = useSearch();
    const [workplace, setWorkplace] = createSignal("all");
    const [employment, setEmployment] = createSignal("all");
    const [count, setCount] = createSignal(pageSize);

    // match location, contract and search terms
    const matches = createMemo(() =>
        (jobs() ?? []).filter(
            (job) =>
                (workplace() === "all" || job.workplace === workplace()) &&
                (employment() === "all" || job.employment === employment()) &&
                matchesSearch(
                    `${job.title} ${job.company.name} ${job.location} ${job.tags.join(" ")}`,
                    terms(),
                ),
        ),
    );

    // restart pagination when the matching vacancies change
    createEffect(on(matches, () => setCount(pageSize)));

    return (
        <>
            <Seo
                title="Jobs"
                description="Tech jobs in Zurich. Browse roles, salaries and remote options from local companies."
            />
            <Page>
                <div class="listing-layout">
                    <Card
                        title="Jobs"
                        heading="h1"
                        class="listing-card"
                        toolbar={<EditLink href="/admin?section=jobs" label="Manage" />}
                    >
                        {/* filter the published vacancies */}
                        <div class="listing-filters">
                            <input
                                aria-label="Search jobs"
                                placeholder="Role, company or technology"
                                value={search()}
                                onInput={(event) => setSearch(event.currentTarget.value)}
                            />
                            <div class="listing-pills">
                                <FilterPills
                                    label="Workplace"
                                    value={
                                        workplace() === "all" && employment() !== "all"
                                            ? ""
                                            : workplace()
                                    }
                                    onChange={(value) => {
                                        setWorkplace(value === workplace() ? "all" : value);
                                        if (value === "all") setEmployment("all");
                                    }}
                                    options={[
                                        { value: "all", label: "All" },
                                        ...Object.entries(workplaces).map(([value, label]) => ({
                                            value,
                                            label,
                                        })),
                                    ]}
                                />
                                <FilterPills
                                    label="Employment"
                                    value={employment()}
                                    onChange={(value) =>
                                        setEmployment(value === employment() ? "all" : value)
                                    }
                                    options={[
                                        ...Object.entries(employments).map(([value, label]) => ({
                                            value,
                                            label,
                                        })),
                                    ]}
                                />
                            </div>
                        </div>
                        {/* render the visible page of matching jobs */}
                        <For each={matches().slice(0, count())}>
                            {(job) => <JobEntry job={job} terms={terms()} />}
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
