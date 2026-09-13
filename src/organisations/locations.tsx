import { leaveEditor, resetEditor, savedEditor, Editor } from "../components/form";
import { useConfirmation } from "../components/dialog";
import { startTransition, createResource, createSignal, For, Show } from "solid-js";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { errorMessage } from "../components/errors";
import { AddressField } from "../components/address";
import { Card } from "../components/card";

/** Editable public location and its resolved address. */
type Location = FunctionReturnType<typeof api.places.locations.list>[number];

/** Manage an organisation's public office locations and team curation. */
export function OrganisationLocations(props: {
    /** Organisation managed by the signed-in account. */ organisationId: Id<"organisations">;
    /** Allow team curation independently of sponsorship. */ isAdmin: boolean;
}) {
    const confirm = useConfirmation();
    const [locations, { refetch }] = createResource(
        () => props.organisationId,
        async (organisationId) =>
            (await memberClient()).query(api.places.locations.list, { ownerId: organisationId }),
    );
    const [error, setError] = createSignal<string>();
    const [isPending, setPending] = createSignal(false);
    const [editing, setEditing] = createSignal<Location | undefined>(undefined, { equals: false });
    let locationForm!: HTMLFormElement;

    /** Persist the selected public address and refresh the list. */
    async function save(event: SubmitEvent) {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const text = (name: string) => String(data.get(name) ?? "").trim();
        setPending(true);
        setError(undefined);
        try {
            if (!text("latitude") || !text("longitude"))
                throw new Error("Select an address from the suggestions.");
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
                ...(props.isAdmin ? { isCurated: data.has("isCurated") } : {}),
            });
            savedEditor(form);
            setEditing(undefined);
            form.reset();
            queueMicrotask(() => resetEditor(form));
            await startTransition(refetch);
        } catch (caught) {
            setError(errorMessage(caught, "Could not save location."));
        } finally {
            setPending(false);
        }
    }

    /** Remove only the selected location, leaving the organisation intact. */
    async function remove(id: Id<"locations">) {
        if (
            !(await confirm({
                title: "Remove location",
                action: "Remove location",
                description: "Remove this location from the organisation and map.",
                isDestructive: true,
                emails: 0,
            }))
        )
            return;
        setPending(true);
        setError(undefined);
        try {
            await (await memberClient()).mutation(api.places.locations.remove, { id });
            if (editing()?._id === id) setEditing(undefined);
            await startTransition(refetch);
        } catch (caught) {
            setError(errorMessage(caught, "Could not remove location."));
        } finally {
            setPending(false);
        }
    }

    return (
        <Card
            title="Locations"
            toolbar={
                <>
                    <button
                        type="submit"
                        form="location-editor"
                        class="button button--primary"
                        disabled={isPending()}
                    >
                        {editing() ? "Save" : "Add location"}
                    </button>
                </>
            }
        >
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
                            onClick={async () => {
                                if (!(await leaveEditor(locationForm))) return;
                                setEditing(location);
                                queueMicrotask(() => resetEditor(locationForm));
                            }}
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
            <Editor
                id="location-editor"
                ref={locationForm}
                class="editor"
                onSubmit={save}
                actions={() => (
                    <div class="form-actions">
                        <button class="button button--primary" type="submit" disabled={isPending()}>
                            {editing() ? "Save" : "Add location"}
                        </button>
                    </div>
                )}
            >
                <label>
                    Name
                    <input
                        name="name"
                        required
                        value={editing()?.name ?? ""}
                        placeholder="Zürich office"
                    />
                </label>
                <AddressField
                    value={{
                        address: editing()?.address?.line1,
                        latitude: editing()?.address?.latitude,
                        longitude: editing()?.address?.longitude,
                    }}
                    onSelect={(place) => {
                        for (const [name, value] of Object.entries(place.address)) {
                            const field = locationForm.elements.namedItem(
                                name,
                            ) as HTMLInputElement | null;
                            if (field) field.value = value ?? "";
                        }
                    }}
                />
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
                <Show when={props.isAdmin}>
                    <label class="checkbox">
                        <input
                            type="checkbox"
                            name="isCurated"
                            checked={editing()?.isCurated ?? false}
                        />{" "}
                        Show on map
                    </label>
                </Show>
                <Show when={error()}>
                    <p role="alert">{error()}</p>
                </Show>

                <Show when={editing()}>
                    <button
                        class="button button--ghost"
                        type="button"
                        disabled={isPending()}
                        onClick={async () => {
                            if (!(await leaveEditor(locationForm))) return;
                            setEditing(undefined);
                            queueMicrotask(() => resetEditor(locationForm));
                        }}
                    >
                        Back
                    </button>
                </Show>
            </Editor>
        </Card>
    );
}
