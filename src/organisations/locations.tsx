import { createResource, createSignal, For, Show } from "solid-js";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { errorMessage } from "../components/errors";
import { Card } from "../components/card";

/** Editable public location and its resolved address. */
type Location = FunctionReturnType<typeof api.places.locations.list>[number];

/** Manage an organisation's public office locations and team curation. */
export function OrganisationLocations(props: {
    /** Organisation managed by the signed-in account. */ organisationId: Id<"organisations">;
    /** Allow team curation independently of sponsorship. */ isTeam: boolean;
}) {
    const [locations, { refetch }] = createResource(
        () => props.organisationId,
        async (organisationId) =>
            (await memberClient()).query(api.places.locations.list, { ownerId: organisationId }),
    );
    const [error, setError] = createSignal<string>();
    const [isPending, setPending] = createSignal(false);
    const [editing, setEditing] = createSignal<Location>();

    /** Persist the selected public address and refresh the list. */
    async function save(event: SubmitEvent) {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const text = (name: string) => String(data.get(name) ?? "").trim();
        setPending(true);
        setError(undefined);
        try {
            await (
                await memberClient()
            ).mutation(api.places.locations.save, {
                id: editing()?._id,
                ownerId: props.organisationId,
                name: text("name"),
                line1: text("line1"),
                locality: text("locality"),
                postalCode: text("postalCode") || undefined,
                countryCode: text("countryCode").toUpperCase(),
                latitude: Number(text("latitude")),
                longitude: Number(text("longitude")),
                ...(props.isTeam ? { isCurated: data.has("isCurated") } : {}),
            });
            setEditing(undefined);
            form.reset();
            await refetch();
        } catch (caught) {
            setError(errorMessage(caught, "Could not save location."));
        } finally {
            setPending(false);
        }
    }

    /** Remove only the selected location, leaving the organisation intact. */
    async function remove(id: Id<"locations">) {
        setPending(true);
        setError(undefined);
        try {
            await (await memberClient()).mutation(api.places.locations.remove, { id });
            if (editing()?._id === id) setEditing(undefined);
            await refetch();
        } catch (caught) {
            setError(errorMessage(caught, "Could not remove location."));
        } finally {
            setPending(false);
        }
    }

    return (
        <Card title="Locations">
            <p>Public offices and campuses. Local sponsors appear on the community map.</p>
            <For each={locations() ?? []}>
                {(location) => (
                    <div class="location-actions">
                        <span>
                            {location.name} · {location.address?.line1}
                        </span>
                        <button
                            type="button"
                            class="button button--ghost"
                            disabled={isPending()}
                            onClick={() => setEditing(location)}
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            class="button button--ghost"
                            disabled={isPending()}
                            onClick={() => remove(location._id)}
                        >
                            Remove
                        </button>
                    </div>
                )}
            </For>
            <form class="editor" onSubmit={save}>
                <label>
                    Location name
                    <input
                        name="name"
                        required
                        value={editing()?.name ?? ""}
                        placeholder="Zürich office"
                    />
                </label>
                <label>
                    Street address
                    <input name="line1" required value={editing()?.address?.line1 ?? ""} />
                </label>
                <div class="form-columns">
                    <label>
                        Postal code
                        <input name="postalCode" value={editing()?.address?.postalCode ?? ""} />
                    </label>
                    <label>
                        City
                        <input
                            name="locality"
                            required
                            value={editing()?.address?.locality ?? "Zürich"}
                        />
                    </label>
                    <label>
                        Country code
                        <input
                            name="countryCode"
                            required
                            pattern="[A-Za-z]{2}"
                            value={editing()?.address?.countryCode ?? "CH"}
                        />
                    </label>
                </div>
                <div class="form-columns">
                    <label>
                        Latitude
                        <input
                            name="latitude"
                            type="number"
                            step="any"
                            min="-90"
                            max="90"
                            required
                            value={editing()?.address?.latitude ?? ""}
                        />
                    </label>
                    <label>
                        Longitude
                        <input
                            name="longitude"
                            type="number"
                            step="any"
                            min="-180"
                            max="180"
                            required
                            value={editing()?.address?.longitude ?? ""}
                        />
                    </label>
                </div>
                <Show when={props.isTeam}>
                    <label>
                        <input
                            type="checkbox"
                            name="isCurated"
                            checked={editing()?.isCurated ?? false}
                        />{" "}
                        Show as a curated institution without sponsorship
                    </label>
                </Show>
                <Show when={error()}>
                    <p role="alert">{error()}</p>
                </Show>
                <button class="button button--primary" type="submit" disabled={isPending()}>
                    {editing() ? "Save location" : "Add location"}
                </button>
                <Show when={editing()}>
                    <button
                        class="button button--ghost"
                        type="button"
                        disabled={isPending()}
                        onClick={() => setEditing(undefined)}
                    >
                        Cancel edit
                    </button>
                </Show>
            </form>
        </Card>
    );
}
