import { createResource, createSignal, For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { memberClient } from "../auth/convex";

/** Link an appearance to an existing member while allowing guest speakers. */
export function SpeakerMember(props: {
    id?: Id<"members">;
    onChange: (id: Id<"members"> | undefined, name?: string) => void;
}) {
    const [search, setSearch] = createSignal("");
    const [results] = createResource(search, async (search) =>
        search.trim().length < 2
            ? []
            : (await memberClient()).query(api.events.speakers.members, { search }),
    );
    return (
        <div>
            <input type="hidden" name="speakerMember" value={props.id ?? ""} />
            <Show
                when={props.id}
                fallback={
                    <label>
                        Find member
                        <input
                            type="search"
                            value={search()}
                            onInput={(event) => setSearch(event.currentTarget.value)}
                            placeholder="Name or affiliation"
                        />
                    </label>
                }
            >
                <div class="form-actions">
                    <span>Member linked</span>
                    <button type="button" class="button" onClick={() => props.onChange(undefined)}>
                        Unlink
                    </button>
                </div>
            </Show>
            <Show when={!props.id && search().length >= 2}>
                <For each={results()}>
                    {(member) => (
                        <button
                            type="button"
                            class="button"
                            onClick={() => {
                                props.onChange(member.id, member.name);
                                setSearch("");
                            }}
                        >
                            {member.name}
                            {member.affiliation ? ` · ${member.affiliation}` : ""}
                        </button>
                    )}
                </For>
                <Show when={!results.loading && !results()?.length}>
                    <p class="text-soft">No matching members</p>
                </Show>
            </Show>
        </div>
    );
}
