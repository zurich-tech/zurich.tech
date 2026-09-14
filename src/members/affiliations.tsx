import { Highlight } from "../components/highlight";
import { createEffect, createSignal, For, Index, Show } from "solid-js";
import type { Affiliation } from "../../convex/members/affiliations";
import "./affiliations.css";

/** Render the same professional identity in profiles, team and event credits. */
export function Affiliations(props: {
    values?: Affiliation[];
    compact?: boolean;
    terms?: readonly string[];
}) {
    return (
        <span class="affiliations" classList={{ "affiliations--compact": props.compact }}>
            <Show when={props.values?.length}>
                <For each={props.values}>
                    {(item) => (
                        <span class="affiliation">
                            <Show when={item.role}>
                                <span>
                                    <Highlight text={item.role} terms={props.terms ?? []} />
                                </span>
                            </Show>
                            <Show when={item.organisation}>
                                <span>
                                    <Highlight text={item.organisation} terms={props.terms ?? []} />
                                </span>
                            </Show>
                        </span>
                    )}
                </For>
            </Show>
        </span>
    );
}

/** Edit ordered role and organisation pairs; absence can inherit a linked profile. */
export function AffiliationFields(props: {
    name: string;
    values?: Affiliation[];
    inherit?: boolean;
}) {
    const [values, setValues] = createSignal<Affiliation[] | undefined>();
    createEffect(() => setValues(props.values));

    return (
        <div class="affiliation-fields">
            <input
                type="hidden"
                name={props.name}
                value={values() === undefined ? "" : JSON.stringify(values())}
            />
            <Show when={props.inherit}>
                <label class="checkbox">
                    <input
                        type="checkbox"
                        checked={values() === undefined}
                        onChange={(event) =>
                            setValues(event.currentTarget.checked ? undefined : [])
                        }
                    />
                    Use profile affiliations
                </label>
            </Show>
            <Show when={!props.inherit || values() !== undefined}>
                <Index each={values() ?? []}>
                    {(item, index) => (
                        <div class="affiliation-fields__row">
                            <label>
                                Role
                                <input
                                    maxlength="120"
                                    value={item().role}
                                    onInput={(event) =>
                                        setValues((rows) =>
                                            rows!.map((row, position) =>
                                                position === index
                                                    ? { ...row, role: event.currentTarget.value }
                                                    : row,
                                            ),
                                        )
                                    }
                                />
                            </label>
                            <label>
                                Organisation
                                <input
                                    maxlength="160"
                                    value={item().organisation}
                                    onInput={(event) =>
                                        setValues((rows) =>
                                            rows!.map((row, position) =>
                                                position === index
                                                    ? {
                                                          ...row,
                                                          organisation: event.currentTarget.value,
                                                      }
                                                    : row,
                                            ),
                                        )
                                    }
                                />
                            </label>
                            <button
                                class="button"
                                type="button"
                                aria-label={`Remove affiliation ${index + 1}`}
                                onClick={() =>
                                    setValues((rows) =>
                                        rows!.filter((_, position) => position !== index),
                                    )
                                }
                            >
                                Remove
                            </button>
                        </div>
                    )}
                </Index>
                <button
                    class="button"
                    type="button"
                    disabled={(values()?.length ?? 0) >= 6}
                    onClick={() =>
                        setValues((rows) => [...(rows ?? []), { role: "", organisation: "" }])
                    }
                >
                    Add affiliation
                </button>
            </Show>
        </div>
    );
}

/** Decode structured form values; absence requests profile inheritance. */
export function readAffiliations(
    value: FormDataEntryValue | null | undefined,
): Affiliation[] | undefined {
    return value ? JSON.parse(String(value)) : undefined;
}
