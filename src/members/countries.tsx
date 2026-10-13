import { Show } from "solid-js";
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

/** Collect optional residence and multiple citizenships through searchable controls. */
export function CountryFields(props: { values: Demographics; question?: SurveyQuestion }) {
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
                <Selection
                    label="Which countries are you a citizen of?"
                    name="citizenship"
                    options={options}
                    values={props.values.citizenships ?? []}
                    isMultiple
                />
            </Show>
        </div>
    );
}
