import { createEffect, createSignal, For, Index, Show } from "solid-js";
import { countries } from "../../convex/members/countries";
import type { Demographics } from "../../convex/members/demographics";
import "../topics/topics.css";

/** Collect private residence and citizenship independently, including multiple citizenships. */
export function CountryFields(props: { values: Demographics }) {
    // show unanswered citizenships as one empty selection
    const [citizenships, setCitizenships] = createSignal<string[]>([]);
    createEffect(() => {
        setCitizenships(props.values.citizenships?.length ? [...props.values.citizenships] : [""]);
    });

    return (
        <div class="country-fields">
            <label>
                Where do you live?
                <select
                    name="residence"
                    value={
                        props.values.residence === undefined ? "CH" : (props.values.residence ?? "")
                    }
                >
                    <option value="">Not answered</option>
                    <For each={countries}>
                        {(country) => <option value={country.value}>{country.label}</option>}
                    </For>
                </select>
            </label>
            <fieldset class="citizenship-fields">
                <legend>Which countries are you a citizen of?</legend>
                <Index each={citizenships()}>
                    {(value, index) => (
                        <div class="citizenship-row">
                            <select
                                name="citizenship"
                                aria-label={`Country of citizenship ${index + 1}`}
                                value={value()}
                                onChange={(event) => {
                                    const next = event.currentTarget.value;
                                    setCitizenships((values) =>
                                        values.map((current, position) =>
                                            position === index ? next : current,
                                        ),
                                    );
                                }}
                            >
                                <option value="">Not answered</option>
                                <For each={countries}>
                                    {(country) => (
                                        <option
                                            value={country.value}
                                            disabled={
                                                country.value !== value() &&
                                                citizenships().includes(country.value)
                                            }
                                        >
                                            {country.label}
                                        </option>
                                    )}
                                </For>
                            </select>
                            <Show when={citizenships().length > 1}>
                                <button
                                    type="button"
                                    class="action-link"
                                    aria-label={`Remove citizenship ${index + 1}`}
                                    onClick={() =>
                                        setCitizenships((values) =>
                                            values.filter((_, position) => position !== index),
                                        )
                                    }
                                >
                                    Remove
                                </button>
                            </Show>
                        </div>
                    )}
                </Index>
                <button
                    type="button"
                    class="action-link"
                    disabled={citizenships().includes("")}
                    onClick={() => setCitizenships((values) => [...values, ""])}
                >
                    Add another citizenship
                </button>
            </fieldset>
        </div>
    );
}
