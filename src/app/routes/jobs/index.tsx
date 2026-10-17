import { useSearchParams } from "@solidjs/router";
import { locationsLabel } from "../../../../convex/jobs/format";
import { getTopics } from "../../../topics/queries";
import { useSearch } from "../../../search/local";
import { matchesSearch } from "../../../../convex/search/ranking";
import { EditLink } from "../../../auth/edit";
import { pageSize } from "../../site";
import { getJobs, type Job } from "../../../jobs/queries";

import { createSignal, createMemo, createEffect, on, For, Show } from "solid-js";

import { Arrow } from "../../../components/arrow";
import { TableToolbar } from "../../../components/toolbar";
import { FilterSelect } from "../../../components/filter-select";
import { X } from "lucide-solid";
import { Card } from "../../../components/card";
import { Page } from "../../page";
import { Seo } from "../../seo";
import { JobEntry } from "../../../jobs/job";
import { FacetList } from "../../../components/facets";
import { workplaces, engagements } from "../../../../convex/jobs/labels";
import { jobPrice, jobDurationDays } from "../../../../convex/sponsorships/plans";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => getJobs(),
};

/** Browse current, reviewed local vacancies. */
export default function Route() {
    const jobs = getJobs.use(() => []);

    // initialise filters and derived lists from the same resolved server snapshot
    return <Show when={jobs()}>{(listings) => <JobList jobs={listings()} />}</Show>;
}

/** Filter and display a resolved collection of public vacancies. */
function JobList(props: { jobs: Job[] }) {
    const jobs = () => props.jobs;
    const [params, setParams] = useSearchParams();
    const company = () => (typeof params.company === "string" ? params.company : "");
    const companies = createMemo(() =>
        [...new Map((jobs() ?? []).map((job) => [job.company.slug, job.company])).values()].sort(
            (a, b) => a.name.localeCompare(b.name),
        ),
    );

    const { query: search, setQuery: setSearch, terms } = useSearch();
    const [workplace, setWorkplace] = createSignal("all");
    const [engagement, setEngagement] = createSignal("all");
    const topics = getTopics.use(() => []);
    const [topic, setTopic] = createSignal("all");
    const [count, setCount] = createSignal(pageSize);

    // match location, contract and search terms
    const matches = createMemo(() =>
        (jobs() ?? []).filter(
            (job) =>
                (!company() || job.company.slug === company()) &&
                (workplace() === "all" || job.workplace === workplace()) &&
                (engagement() === "all" || job.engagement === engagement()) &&
                (topic() === "all" || job.topics.includes(topic())) &&
                matchesSearch(
                    `${job.title} ${job.company.name} ${locationsLabel(job.locations)} ${[...job.topics, ...job.skills].join(" ")}`,
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
            <Page class="publication">
                <div class="listing-layout">
                    <Card
                        title="Jobs"
                        heading="h1"
                        class="listing-card"
                        toolbar={
                            <>
                                <button
                                    type="button"
                                    class="job-filters__clear"
                                    title="Clear filters"
                                    aria-label="Clear filters"
                                    disabled={
                                        workplace() === "all" &&
                                        engagement() === "all" &&
                                        topic() === "all" &&
                                        !company()
                                    }
                                    onClick={() => {
                                        setWorkplace("all");
                                        setEngagement("all");
                                        setTopic("all");
                                        setParams({ company: undefined });
                                    }}
                                >
                                    <X size={16} aria-hidden="true" />
                                </button>
                                <EditLink href="/admin?section=jobs" label="Manage" />
                            </>
                        }
                    >
                        {/* filter the published vacancies */}
                        <TableToolbar
                            value={search()}
                            onSearch={setSearch}
                            placeholder="Search roles, companies or technologies…"
                        >
                            <div class="job-filters">
                                <FilterSelect
                                    label="Workplace"
                                    value={workplace()}
                                    onChange={setWorkplace}
                                    options={[
                                        { value: "all", label: "All workplaces" },
                                        ...Object.entries(workplaces).map(([value, label]) => ({
                                            value,
                                            label,
                                        })),
                                    ]}
                                />
                                <FilterSelect
                                    label="Employment"
                                    value={engagement()}
                                    onChange={setEngagement}
                                    options={[
                                        { value: "all", label: "All employment" },
                                        ...Object.entries(engagements).map(([value, label]) => ({
                                            value,
                                            label,
                                        })),
                                    ]}
                                />
                                <FilterSelect
                                    label="Topics"
                                    value={topic()}
                                    onChange={setTopic}
                                    options={[
                                        { value: "all", label: "All topics" },
                                        ...(topics() ?? [])
                                            .filter((topic) =>
                                                jobs()?.some((job) =>
                                                    job.topics.includes(topic.slug),
                                                ),
                                            )
                                            .map((topic) => ({
                                                value: topic.slug,
                                                label: topic.name,
                                            })),
                                    ]}
                                />
                                <FilterSelect
                                    label="Company"
                                    value={company()}
                                    onChange={(value) => setParams({ company: value || undefined })}
                                    options={[
                                        { value: "", label: "All companies" },
                                        ...companies().map((item) => ({
                                            value: item.slug,
                                            label: item.name,
                                        })),
                                    ]}
                                />
                            </div>
                        </TableToolbar>
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
                    {/* browse by employer, then the listing price and employer actions */}
                    <aside class="listing-sidebar">
                        <Show when={companies().length}>
                            <FacetList
                                title="Companies"
                                facets={[
                                    {
                                        label: "All companies",
                                        href: "/jobs",
                                        meta: String(jobs()?.length ?? 0),
                                        isSelected: !company(),
                                    },
                                    ...companies().map((item) => ({
                                        label: item.name,
                                        href: `/jobs?company=${encodeURIComponent(item.slug)}`,
                                        meta: String(
                                            jobs()?.filter((job) => job.company.slug === item.slug)
                                                .length ?? 0,
                                        ),
                                        isSelected: company() === item.slug,
                                    })),
                                ]}
                            />
                        </Show>
                        <Card title="Hiring?" class="offer-card">
                            <p class="tier-price">
                                <span>CHF</span> {jobPrice}
                                <span>/ listing · {jobDurationDays} days</span>
                            </p>
                            <p class="text-soft">One payment. No subscription.</p>
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
                                    <strong>Applications go directly to you</strong>
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
