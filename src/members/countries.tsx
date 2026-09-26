import { createEffect, createSignal, For, Index, Show } from "solid-js";
import { countries } from "../../convex/members/countries";
import type { Demographics } from "../../convex/members/demographics";
import "../topics/topics.css";

/** Collect private residence and citizenship independently, including multiple citizenships. */
export function CountryFields(props: { values: Demographics }) {
    const [citizenships, setCitizenships] = createSignal<string[]>([]);
    const [isWithheld, setIsWithheld] = createSignal(false);
    createEffect(() => {
        setCitizenships(props.values.citizenships?.length ? [...props.values.citizenships] : [""]);
        setIsWithheld(props.values.citizenships === null);
    });

    return (
        <div class="country-fields">
            <label>
                Where do you live?
                <select
                    name="residence"
                    value={
                        props.values.residence === null
                            ? "withheld"
                            : (props.values.residence ?? "")
                    }
                >
                    <option value="">Not answered</option>
                    <For each={countries}>
                        {(country) => <option value={country.value}>{country.label}</option>}
                    </For>
                    <option value="withheld">Prefer not to say</option>
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
                                disabled={isWithheld()}
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
                                    disabled={isWithheld()}
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
                    disabled={isWithheld() || citizenships().includes("")}
                    onClick={() => setCitizenships((values) => [...values, ""])}
                >
                    Add another citizenship
                </button>
                <label class="checkbox">
                    <input
                        type="checkbox"
                        name="citizenshipsWithheld"
                        checked={isWithheld()}
                        onChange={(event) => setIsWithheld(event.currentTarget.checked)}
                    />
                    Prefer not to say
                </label>
            </fieldset>
        </div>
    );
}
