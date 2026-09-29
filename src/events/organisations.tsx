import { createEffect, createSignal, createUniqueId, For, Show } from "solid-js";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import type { getDirectory } from "../organisations/queries";
import { Select } from "../components/field";

/** Search participating organisations and edit only their selected roles. */
export function OrganisationFields(props: {
    /** Existing participation roles. */
    draft: Doc<"submissions"> | undefined;
    /** Available organisations. */
    directory: Awaited<ReturnType<typeof getDirectory>> | undefined;
}) {
    const id = createUniqueId();
    const [search, setSearch] = createSignal("");
    const [selected, setSelected] = createSignal<Id<"organisations">[]>([]);
    let input!: HTMLInputElement;

    // restore selections when another revision is loaded
    createEffect(() => {
        setSelected([
            ...new Set([...(props.draft?.organisations ?? []), ...(props.draft?.partnerIds ?? [])]),
        ]);
        setSearch("");
    });

    // search the bounded directory locally without rendering unselected role controls
    const results = () => {
        const query = search().trim().toLocaleLowerCase();
        return query
            ? (props.directory?.organisations ?? []).filter(
                  (item) =>
                      !selected().includes(item._id) &&
                      item.name.toLocaleLowerCase().includes(query),
              )
            : [];
    };

    return (
        <fieldset class="event-organisations">
            <legend>Organisations</legend>
            {/* selected roles remain in the form while searching */}
            <For each={selected()}>
                {(organisationId) => (
                    <div class="event-organisations__row">
                        <label>
                            {props.directory?.organisations.find(
                                (item) => item._id === organisationId,
                            )?.name ?? organisationId}
                            <Select
                                name={`organisation:${organisationId}`}
                                value={
                                    props.draft?.partnerIds?.includes(organisationId)
                                        ? "partner"
                                        : "supporter"
                                }
                            >
                                <option value="supporter">Host / supporter</option>
                                <option value="partner">Partner</option>
                            </Select>
                        </label>
                        <button
                            type="button"
                            class="button"
                            aria-label="Remove organisation"
                            title="Remove organisation"
                            onClick={() => {
                                setSelected((items) =>
                                    items.filter((item) => item !== organisationId),
                                );
                                input.focus();
                            }}
                        >
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                )}
            </For>
            {/* search results are keyboard reachable without submitting the event */}
            <label for={id}>Add organisation</label>
            <input
                ref={input}
                id={id}
                type="search"
                autocomplete="off"
                placeholder="Search organisations"
                value={search()}
                onInput={(event) => setSearch(event.currentTarget.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                    else if (event.key === "Escape") {
                        event.preventDefault();
                        setSearch("");
                    }
                }}
            />
            <Show when={search().trim()}>
                <ul class="event-organisations__results" aria-label="Matching organisations">
                    <For
                        each={results()}
                        fallback={<li role="status">No matching organisations</li>}
                    >
                        {(item) => (
                            <li>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelected((items) => [...items, item._id]);
                                        setSearch("");
                                        input.focus();
                                    }}
                                >
                                    {item.name}
                                </button>
                            </li>
                        )}
                    </For>
                </ul>
            </Show>
        </fieldset>
    );
}
