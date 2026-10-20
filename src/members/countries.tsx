import { createSignal, For, Show } from "solid-js";
import { countries } from "../../convex/members/countries";
import type { Demographics, SurveyQuestion } from "../../convex/members/demographics";
import { Selection } from "../components/selection";

/** Common alternate country names used when searching. */
const aliases: Record<string, string> = {
    CH: "Schweiz Suisse Svizzera Svizra Swiss",
    GB: "UK Britain Great Britain England Scotland Wales Northern Ireland",
    US: "USA America United States of America",
    DE: "Deutschland",
    AT: "Osterreich Österreich",
    NL: "Holland Nederland",
    KR: "South Korea",
    CZ: "Czech Republic",
    AE: "UAE",
    CI: "Ivory Coast",
    TR: "Turkey Türkiye",
};
/** Search labels and stable country codes without inferring citizenship. */
const options = countries.map((country) => ({ ...country, aliases: aliases[country.value] }));
/**
 * The 16 largest nationality groups in Zurich's 2025 resident population.
 *
 * Source: https://data.stadt-zuerich.ch/dataset/bev_bestand_jahr_quartier_nationalitaet_od3361
 */
const common = [
    "AT",
    "CN",
    "ER",
    "FR",
    "DE",
    "GR",
    "IN",
    "IT",
    "PL",
    "PT",
    "ES",
    "CH",
    "TR",
    "UA",
    "GB",
    "US",
];
/** Alphabetical country choices shown directly in the survey. */
const shortcuts = options.filter((country) => common.includes(country.value));
/** Searchable countries outside the fixed shortcut grid. */
const additional = options.filter((country) => !common.includes(country.value));

/** Collect optional residence and multiple citizenships through searchable controls. */
export function CountryFields(props: { values: Demographics; question?: SurveyQuestion }) {
    const [isExpanded, setExpanded] = createSignal(false);

    return (
        <div class="country-fields">
            <Show when={!props.question || props.question === "residence"}>
                <Selection
                    label="Where do you live?"
                    name="residence"
                    options={options}
                    values={
                        props.values.residence === undefined
                            ? ["CH"]
                            : props.values.residence
                              ? [props.values.residence]
                              : []
                    }
                />
            </Show>
            <Show when={!props.question || props.question === "citizenships"}>
                <fieldset class="survey-choice">
                    <legend>Which countries are you a citizen of?</legend>
                    <div class="choice-grid country-choices">
                        <For each={shortcuts}>
                            {(country) => (
                                <label class="checkbox">
                                    <input
                                        type="checkbox"
                                        name="citizenship"
                                        value={country.value}
                                        checked={
                                            props.values.citizenships?.includes(country.value) ??
                                            false
                                        }
                                    />
                                    <span>{country.label}</span>
                                </label>
                            )}
                        </For>
                    </div>
                    <Show
                        when={
                            isExpanded() ||
                            props.values.citizenships?.some((value) => !common.includes(value))
                        }
                        fallback={
                            <button
                                type="button"
                                class="action-link"
                                onClick={() => setExpanded(true)}
                            >
                                Other countries
                            </button>
                        }
                    >
                        <Selection
                            label="Other countries"
                            name="citizenship"
                            options={additional}
                            values={(props.values.citizenships ?? []).filter(
                                (value) => !common.includes(value),
                            )}
                            isMultiple
                        />
                    </Show>
                </fieldset>
            </Show>
        </div>
    );
}
