import { countries } from "../../convex/members/countries";
import { Index } from "solid-js";
import "./jobs.css";
import { Input, Select } from "../components/field";
import { createSignal, For, Show } from "solid-js";
import type { Doc } from "../../convex/_generated/dataModel";
import { Editor, FormMessage } from "../components/form";
import { Card } from "../components/card";
import { MarkdownEditor } from "../components/markdown-editor";
import { TopicFields } from "../topics/fields";
import { CompanySelect } from "../organisations/company";
import { engagements, seniorities } from "./filters";
import { jobPrice, jobDurationMonths } from "../sponsorships/plans";

/** Edit the vacancy fields and request publication review. */
export function JobForm(props: {
    isAdmin?: boolean;
    /** Editable vacancy fields. */
    draft: Doc<"jobs">["draft"] | Doc<"jobs"> | undefined;
    /** Existing published vacancy, if any. */
    job: Doc<"jobs"> | undefined;
    /** Companies available to the employer. */
    companies: {
        _id: string;
        name: string;
        website: string;
        logoUrl?: string;
        logoDarkUrl?: string;
    }[];
    organisationId?: string;
    /** Disable submission while saving. */
    isPending: boolean;
    /** Signed-in account email. */
    email: string | undefined;
    /** Submission failure. */
    error: string | undefined;
    /** Save the authored revision. */
    onSubmit: (event: SubmitEvent) => Promise<void>;
}) {
    const [locations, setLocations] = createSignal(
        props.draft?.locations ?? [{ locality: "", countryCode: "CH" }],
    );
    const [description, setDescription] = createSignal(props.draft?.description ?? "");
    const [application, setApplication] = createSignal(props.draft?.application.kind ?? "url");
    const [workplace, setWorkplace] = createSignal(props.draft?.workplace ?? "onsite");
    const [duration, setDuration] = createSignal(props.draft?.duration?.kind ?? "");
    return (
        <Editor
            id="job-editor"
            class="editor"
            onSubmit={props.onSubmit}
            actions={() => (
                <div class="row-actions">
                    <button class="button" value="preview" disabled={props.isPending}>
                        Save & preview
                    </button>
                    <button class="button" value="draft" disabled={props.isPending}>
                        {props.isPending ? "Saving…" : "Save"}
                    </button>
                    <Show when={!props.isAdmin}>
                        <button
                            class="button button--primary"
                            value="review"
                            disabled={props.isPending}
                        >
                            {props.isPending ? "Saving…" : "Submit for review"}
                        </button>
                    </Show>
                </div>
            )}
        >
            <div class="editor-columns">
                <div class="editor-column">
                    <Card title="Job">
                        <div class="form-columns">
                            <label>
                                Title
                                <Input
                                    name="title"
                                    required
                                    maxlength="180"
                                    value={props.draft?.title ?? ""}
                                />
                            </label>
                            <label>
                                Slug
                                <Input
                                    name="slug"
                                    required
                                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                                    readonly={!!props.job?.publishedAt}
                                    value={props.draft?.slug ?? ""}
                                />
                            </label>
                        </div>
                        <label>
                            Short summary
                            <Input
                                name="summary"
                                required
                                maxlength="300"
                                value={props.draft?.summary ?? ""}
                            />
                        </label>
                        <MarkdownEditor
                            label="Description"
                            value={description()}
                            onChange={setDescription}
                        />
                        <Input type="hidden" name="description" value={description()} />
                        <TopicFields values={props.draft?.topics ?? []} />
                        <label>
                            Skills <span>Comma-separated</span>
                            <Input name="skills" value={props.draft?.skills.join(", ") ?? ""} />
                        </label>
                    </Card>
                    <Card title="Compensation">
                        <p class="text-soft">
                            Optional. Gross base pay; leave undisclosed amounts blank.
                        </p>
                        <RangeFields
                            label="Salary"
                            name="salary"
                            value={props.draft?.compensation?.salary?.amount}
                        />
                        <div class="form-columns">
                            <label>
                                Currency
                                <Select
                                    name="currency"
                                    value={props.draft?.compensation?.salary?.currency ?? "CHF"}
                                >
                                    <For
                                        each={[
                                            "CHF",
                                            "EUR",
                                            "USD",
                                            ...Intl.supportedValuesOf("currency").filter(
                                                (code) => !["CHF", "EUR", "USD"].includes(code),
                                            ),
                                        ]}
                                    >
                                        {(code) => <option>{code}</option>}
                                    </For>
                                </Select>
                            </label>
                            <label>
                                Period
                                <Select
                                    name="period"
                                    value={props.draft?.compensation?.salary?.period ?? "year"}
                                >
                                    <For each={["year", "month", "day", "hour"]}>
                                        {(period) => <option value={period}>Per {period}</option>}
                                    </For>
                                </Select>
                            </label>
                        </div>
                        <label>
                            Salary basis
                            <Select
                                name="basis"
                                value={props.draft?.compensation?.salary?.basis ?? "full-time"}
                            >
                                <option value="full-time">Full-time equivalent (100%)</option>
                                <option value="workload">Actual pay for stated workload</option>
                            </Select>
                        </label>
                        <RangeFields
                            label="Equity (%)"
                            name="equity"
                            value={props.draft?.compensation?.equity}
                            max={100}
                        />
                    </Card>
                </div>
                <aside class="editor-column">
                    <Card title="Details">
                        <CompanySelect
                            companies={props.companies}
                            value={props.draft?.organisationId ?? props.organisationId}
                            isDisabled={!!props.job?.publishedAt}
                        />
                        <fieldset class="job-range">
                            <legend>Locations</legend>
                            <input
                                type="hidden"
                                name="locations"
                                value={JSON.stringify(locations())}
                            />
                            <Index each={locations()}>
                                {(location, index) => (
                                    <div class="form-columns">
                                        <label>
                                            City
                                            <Input
                                                required
                                                value={location().locality}
                                                onInput={(event) =>
                                                    setLocations((values) =>
                                                        values.map((value, i) =>
                                                            i === index
                                                                ? {
                                                                      ...value,
                                                                      locality:
                                                                          event.currentTarget.value,
                                                                  }
                                                                : value,
                                                        ),
                                                    )
                                                }
                                            />
                                        </label>
                                        <label>
                                            Country
                                            <Select
                                                value={location().countryCode}
                                                onChange={(event) =>
                                                    setLocations((values) =>
                                                        values.map((value, i) =>
                                                            i === index
                                                                ? {
                                                                      ...value,
                                                                      countryCode:
                                                                          event.currentTarget.value,
                                                                  }
                                                                : value,
                                                        ),
                                                    )
                                                }
                                            >
                                                <For each={countries}>
                                                    {(country) => (
                                                        <option value={country.value}>
                                                            {country.label}
                                                        </option>
                                                    )}
                                                </For>
                                            </Select>
                                        </label>
                                        <button
                                            type="button"
                                            class="action-link"
                                            onClick={() =>
                                                setLocations((values) =>
                                                    values.filter((_, i) => i !== index),
                                                )
                                            }
                                        >
                                            Remove location
                                        </button>
                                    </div>
                                )}
                            </Index>
                            <button
                                type="button"
                                class="action-link"
                                disabled={locations().length >= 10}
                                onClick={() =>
                                    setLocations((values) => [
                                        ...values,
                                        { locality: "", countryCode: "CH" },
                                    ])
                                }
                            >
                                Add location
                            </button>
                        </fieldset>
                        <label>
                            Workplace
                            <Select
                                name="workplace"
                                value={workplace()}
                                onChange={(event) =>
                                    setWorkplace(
                                        event.currentTarget.value as "onsite" | "hybrid" | "remote",
                                    )
                                }
                            >
                                <option value="onsite">On-site</option>
                                <option value="hybrid">Hybrid</option>
                                <option value="remote">Remote</option>
                            </Select>
                        </label>
                        <Show when={workplace() !== "onsite"}>
                            <label>
                                Remote eligibility
                                <Input
                                    name="remoteEligibility"
                                    placeholder="Countries or time zones"
                                    maxlength="300"
                                    value={props.draft?.remoteEligibility ?? ""}
                                />
                            </label>
                        </Show>
                        <label>
                            Engagement
                            <Select
                                name="engagement"
                                value={props.draft?.engagement ?? "employment"}
                            >
                                <For each={Object.entries(engagements)}>
                                    {([value, label]) => <option value={value}>{label}</option>}
                                </For>
                            </Select>
                        </label>
                        <label>
                            Duration
                            <Select
                                name="duration"
                                value={duration()}
                                onChange={(event) =>
                                    setDuration(
                                        event.currentTarget.value as "" | "permanent" | "fixed",
                                    )
                                }
                            >
                                <option value="">Not specified</option>
                                <option value="permanent">Permanent</option>
                                <option value="fixed">Fixed term</option>
                            </Select>
                        </label>
                        <Show when={duration() === "fixed"}>
                            <label>
                                Months <span>Optional</span>
                                <Input
                                    type="number"
                                    name="months"
                                    min="1"
                                    max="120"
                                    value={
                                        props.draft?.duration?.kind === "fixed"
                                            ? (props.draft.duration.months ?? "")
                                            : ""
                                    }
                                />
                            </label>
                        </Show>
                        <RangeFields
                            label="Workload (%)"
                            name="workload"
                            value={props.draft?.workload}
                            max={100}
                        />
                        <label>
                            Seniority
                            <Select name="seniority" value={props.draft?.seniority ?? ""}>
                                <option value="">Not specified</option>
                                <For each={Object.entries(seniorities)}>
                                    {([value, label]) => <option value={value}>{label}</option>}
                                </For>
                            </Select>
                        </label>
                        <label>
                            Languages <span>Comma-separated</span>
                            <Input
                                name="languages"
                                value={props.draft?.languages.join(", ") ?? ""}
                            />
                        </label>
                        <label>
                            Visa sponsorship
                            <Select
                                name="visa"
                                value={
                                    props.draft?.visaSponsorship === undefined
                                        ? ""
                                        : props.draft.visaSponsorship
                                          ? "yes"
                                          : "no"
                                }
                            >
                                <option value="">Not specified</option>
                                <option value="yes">Available</option>
                                <option value="no">Unavailable</option>
                            </Select>
                        </label>
                    </Card>
                    <Card title="Application">
                        <label>
                            Destination
                            <Select
                                name="applicationKind"
                                value={application()}
                                onChange={(event) =>
                                    setApplication(event.currentTarget.value as "url" | "email")
                                }
                            >
                                <option value="url">Website</option>
                                <option value="email">Email</option>
                            </Select>
                        </label>
                        <Show
                            when={application() === "url"}
                            fallback={
                                <>
                                    <label>
                                        Email
                                        <Input
                                            name="applicationEmail"
                                            type="email"
                                            required
                                            value={
                                                props.draft?.application.kind === "email"
                                                    ? props.draft.application.email
                                                    : ""
                                            }
                                        />
                                    </label>
                                    <label>
                                        Subject <span>Optional</span>
                                        <Input
                                            name="applicationSubject"
                                            maxlength="200"
                                            value={
                                                props.draft?.application.kind === "email"
                                                    ? (props.draft.application.subject ?? "")
                                                    : ""
                                            }
                                        />
                                    </label>
                                </>
                            }
                        >
                            <label>
                                Application URL
                                <Input
                                    name="applicationUrl"
                                    type="url"
                                    required
                                    value={
                                        props.draft?.application.kind === "url"
                                            ? props.draft.application.url
                                            : ""
                                    }
                                />
                            </label>
                        </Show>
                        <label>
                            Application deadline <span>Optional; end of day UTC</span>
                            <Input
                                type="date"
                                name="deadline"
                                value={
                                    props.draft?.applicationDeadline
                                        ? new Date(props.draft.applicationDeadline)
                                              .toISOString()
                                              .slice(0, 10)
                                        : ""
                                }
                            />
                        </label>
                    </Card>
                    <Card title="Listing">
                        <label>
                            Invoice email
                            <Input
                                name="billingEmail"
                                type="email"
                                required
                                value={props.job?.billingEmail ?? props.email ?? ""}
                            />
                        </label>

                        <p>
                            CHF {jobPrice} · {jobDurationMonths} months. Included for sponsors.
                        </p>
                        <p class="text-soft">
                            Reviewed before publication. Reconfirm every 90 days.
                        </p>
                    </Card>
                </aside>
            </div>
            <FormMessage error={props.error} />
        </Editor>
    );
}

/** Collect a quantity with optional lower and upper bounds. */
function RangeFields(props: {
    label: string;
    name: string;
    value?: { min?: number; max?: number };
    max?: number;
}) {
    return (
        <fieldset class="job-range">
            <legend>{props.label}</legend>
            <div class="form-columns">
                <label>
                    Minimum
                    <Input
                        type="number"
                        step="any"
                        min="0"
                        max={props.max}
                        name={`${props.name}Min`}
                        value={props.value?.min ?? ""}
                    />
                </label>
                <label>
                    Maximum
                    <Input
                        type="number"
                        step="any"
                        min="0"
                        max={props.max}
                        name={`${props.name}Max`}
                        value={props.value?.max ?? ""}
                    />
                </label>
            </div>
        </fieldset>
    );
}
