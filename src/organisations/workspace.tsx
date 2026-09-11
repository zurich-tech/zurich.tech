import { For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { useWorkspaceCommand } from "../app/workspace";
import { FormMessage } from "../components/form";
import { createAsync, revalidate } from "@solidjs/router";
import { getDirectory } from "./queries";
import type { Id } from "../../convex/_generated/dataModel";

/** Public organisations and recurring event series. */
type Directory = Awaited<ReturnType<typeof getDirectory>>;

/** Edit the team’s organisation or series catalogue. */
export function Catalogue(props: {
    /** Catalogue selected by the workspace tab. */
    section: "organisations" | "series";
}) {
    const directory = createAsync(() => getDirectory());
    const { perform, isPending, error, success } = useWorkspaceCommand(() =>
        revalidate(getDirectory.key),
    );

    /** Save a team-maintained organisation. */
    async function saveOrganisation(event: SubmitEvent) {
        // read the submitted fields
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const values = new FormData(form);
        const text = (key: string) => String(values.get(key) ?? "");

        // save and refresh the visible catalogue
        await perform(
            async () =>
                await (
                    await memberClient()
                ).mutation(api.organisations.mutations.upsert, {
                    id: text("id") ? (text("id") as Id<"organisations">) : undefined,
                    name: text("name"),
                    slug: text("slug"),
                    description: text("description"),
                    website: text("website"),
                    location: text("location"),
                    headline: text("headline").trim() || undefined,
                    kind: text("kind") as "company" | "lab" | "community" | "space",
                }),
            "Organisation saved.",
        );
    }

    /** Save a team-maintained event series. */
    async function saveSeries(event: SubmitEvent) {
        // read the submitted fields
        event.preventDefault();
        const values = new FormData(event.currentTarget as HTMLFormElement);
        const text = (key: string) => String(values.get(key) ?? "");

        // save and refresh the visible catalogue
        await perform(
            async () =>
                await (
                    await memberClient()
                ).mutation(api.events.series.upsert, {
                    id: text("id") ? (text("id") as Id<"series">) : undefined,
                    name: text("name"),
                    slug: text("slug"),
                    description: text("description"),
                    topics: text("topics")
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                }),
            "Series saved.",
        );
    }

    return (
        <>
            <FormMessage error={error()} success={success()} />
            <Show
                when={props.section === "organisations"}
                fallback={
                    <SeriesCatalogue
                        series={directory()?.series}
                        onSave={saveSeries}
                        isPending={isPending()}
                    />
                }
            >
                <OrganisationCatalogue
                    organisations={directory()?.organisations}
                    onSave={saveOrganisation}
                    isPending={isPending()}
                />
            </Show>
        </>
    );
}

/** Edit existing organisations and create new profiles. */
function OrganisationCatalogue(props: {
    /** Public organisation profiles. */
    organisations: Directory["organisations"] | undefined;
    /** Save one organisation profile. */
    onSave: (event: SubmitEvent) => Promise<void>;
    /** Disable actions while a workspace command is pending. */
    isPending: boolean;
}) {
    return (
        <div class="admin-catalogue">
            <For each={props.organisations}>
                {(item) => (
                    <details>
                        <summary>{item.name}</summary>
                        <OrganisationForm
                            item={item}
                            onSubmit={props.onSave}
                            isPending={props.isPending}
                        />
                    </details>
                )}
            </For>
            <h2>Add an organisation</h2>
            <OrganisationForm onSubmit={props.onSave} isPending={props.isPending} />
        </div>
    );
}

/** Edit a curated organisation. */
function OrganisationForm(props: {
    /** Organisation being edited, or absent for a new profile. */
    item?: Directory["organisations"][number];
    /** Save the authored organisation. */
    onSubmit: (event: SubmitEvent) => Promise<void>;
    /** Disable submission while saving. */
    isPending: boolean;
}) {
    return (
        <form class="editor" onSubmit={props.onSubmit}>
            <input type="hidden" name="id" value={props.item?._id ?? ""} />
            <div class="form-columns">
                <label>
                    Name
                    <input required name="name" value={props.item?.name ?? ""} />
                </label>
                <label>
                    Slug
                    <input required name="slug" value={props.item?.slug ?? ""} />
                </label>
            </div>
            <label>
                Description
                <textarea required name="description" value={props.item?.description ?? ""} />
            </label>
            <div class="form-columns">
                <label>
                    Website
                    <input required type="url" name="website" value={props.item?.website ?? ""} />
                </label>
                <label>
                    Location
                    <input required name="location" value={props.item?.location ?? "Zürich"} />
                </label>
            </div>
            <label>
                Headline
                <input name="headline" maxlength="160" value={props.item?.headline ?? ""} />
            </label>
            <label>
                Type
                <select name="kind" value={props.item?.kind ?? "company"}>
                    <For each={["company", "lab", "community", "space"]}>
                        {(kind) => <option value={kind}>{kind}</option>}
                    </For>
                </select>
            </label>
            <button class="button" disabled={props.isPending}>
                Save organisation
            </button>
        </form>
    );
}

/** Edit recurring series and create new ones. */
function SeriesCatalogue(props: {
    /** Recurring event series. */
    series: Directory["series"] | undefined;
    /** Save one recurring series. */
    onSave: (event: SubmitEvent) => Promise<void>;
    /** Disable actions while a workspace command is pending. */
    isPending: boolean;
}) {
    return (
        <div class="admin-catalogue">
            <For each={props.series}>
                {(item) => (
                    <details>
                        <summary>{item.name}</summary>
                        <SeriesForm
                            item={item}
                            onSubmit={props.onSave}
                            isPending={props.isPending}
                        />
                    </details>
                )}
            </For>
            <h2>Add a series</h2>
            <SeriesForm onSubmit={props.onSave} isPending={props.isPending} />
        </div>
    );
}

/** Edit a recurring series and its default topics. */
function SeriesForm(props: {
    /** Series being edited, or absent for a new series. */
    item?: Directory["series"][number];
    /** Save the authored series. */
    onSubmit: (event: SubmitEvent) => Promise<void>;
    /** Disable submission while saving. */
    isPending: boolean;
}) {
    return (
        <form class="editor" onSubmit={props.onSubmit}>
            <input type="hidden" name="id" value={props.item?._id ?? ""} />
            <div class="form-columns">
                <label>
                    Name
                    <input required name="name" value={props.item?.name ?? ""} />
                </label>
                <label>
                    Slug
                    <input required name="slug" value={props.item?.slug ?? ""} />
                </label>
            </div>
            <label>
                Description
                <textarea required name="description" value={props.item?.description ?? ""} />
            </label>
            <label>
                Topics
                <input name="topics" value={props.item?.topics.join(", ") ?? ""} />
            </label>
            <button class="button" disabled={props.isPending}>
                Save series
            </button>
        </form>
    );
}
