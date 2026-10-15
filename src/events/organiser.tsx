import { Affiliations } from "../members/affiliations";
import type { Affiliation } from "../../convex/members/affiliations";
import { Card } from "../components/card";
import { For, Show, createSignal, createEffect } from "solid-js";
import { getTeam, getMembers } from "../members/queries";
import "./organiser.css";

/** Public identity shared by named credits and compact avatar groups. */
export type OrganiserPerson = {
    name: string;
    href: string;
    image?: string;
    headline?: string;
    affiliations?: Affiliation[];
};

/** Show a linked public organiser without implying editing access. */
export function Organiser(props: {
    compact?: boolean;
    detailed?: boolean;
    person?: OrganiserPerson | null;
}) {
    return (
        <Show when={props.person}>
            {(person) => (
                <a
                    class="organiser"
                    classList={{ "organiser--detailed": props.detailed }}
                    href={person().href}
                    title={`Organiser: ${person().name}`}
                    aria-label={`Organiser: ${person().name}`}
                >
                    <Show
                        when={person().image}
                        fallback={
                            <span class="organiser-initials" aria-hidden="true">
                                {person()
                                    .name.split(/\s+/)
                                    .map((part) => part[0])
                                    .slice(0, 2)
                                    .join("")}
                            </span>
                        }
                    >
                        <img src={person().image} alt="" width="24" height="24" loading="lazy" />
                    </Show>
                    <Show when={!props.compact}>
                        <div class="organiser-copy">
                            <strong>{person().name}</strong>
                            <Show when={props.detailed}>
                                <Affiliations values={person().affiliations?.slice(0, 1)} />
                            </Show>
                        </div>
                    </Show>
                </a>
            )}
        </Show>
    );
}

/** Keep primary and secondary credits in the same order on every surface. */
export function Organisers(props: {
    primary?: OrganiserPerson | null;
    others?: OrganiserPerson[];
    compact?: boolean;
    detailed?: boolean;
    href?: string;
}) {
    const people = () =>
        [props.primary, ...(props.others ?? [])]
            .filter((person): person is OrganiserPerson => !!person)
            .filter(
                (person, index, all) =>
                    all.findIndex((other) => other.href === person.href) === index,
            );
    return (
        <div class="organisers" classList={{ "organisers--detailed": props.detailed }}>
            <For each={props.compact ? people().slice(0, 3) : people()}>
                {(person) => (
                    <Organiser person={person} compact={props.compact} detailed={props.detailed} />
                )}
            </For>
            <Show when={props.compact && people().length > 3}>
                <a
                    class="organisers-more"
                    href={props.href}
                    title={people()
                        .slice(3)
                        .map((person) => person.name)
                        .join(", ")}
                    aria-label={`${people().length - 3} more organisers`}
                >
                    +{people().length - 3}
                </a>
            </Show>
        </div>
    );
}

/** Choose public attribution separately from editing permissions, retaining display order. */
export function OrganiserField(props: {
    value?: string;
    coOrganisers?: string[];
    inherit?: boolean;
}) {
    const team = getTeam.use(() => []);
    const members = getMembers.use(() => []);
    const choices = () =>
        [
            ...new Map(
                [...(team() ?? []), ...(members() ?? [])].map((person) => [person.id, person]),
            ).values(),
        ].sort((a, b) => a.name.localeCompare(b.name));
    const [primary, setPrimary] = createSignal("");
    const [inherits, setInherits] = createSignal(false);
    const [others, setOthers] = createSignal<string[]>([]);
    createEffect(() => {
        setPrimary(props.value ?? "");
        setInherits(!!props.inherit && props.coOrganisers === undefined);
        setOthers(props.coOrganisers ?? []);
    });

    function move(index: number, direction: number) {
        const values = [...others()];
        [values[index], values[index + direction]] = [values[index + direction], values[index]];
        setOthers(values);
    }
    return (
        <div class="organiser-fields">
            <label>
                Primary organiser
                <select
                    name="primaryOrganiserId"
                    value={primary()}
                    onChange={(event) => {
                        setPrimary(event.currentTarget.value);
                        setOthers(others().filter((id) => id !== event.currentTarget.value));
                    }}
                >
                    <option value="">{props.inherit ? "Use series organiser" : "None"}</option>
                    <For each={choices()}>
                        {(person) => <option value={person.id}>{person.name}</option>}
                    </For>
                </select>
            </label>
            {/* only offer a mode choice when a series can supply the credits */}
            <Show
                when={props.inherit}
                fallback={<input type="hidden" name="coOrganiserMode" value="custom" />}
            >
                <label>
                    Co-organisers
                    <select
                        name="coOrganiserMode"
                        value={inherits() ? "inherit" : "custom"}
                        onChange={(event) => setInherits(event.currentTarget.value === "inherit")}
                    >
                        <option value="inherit">Use series co-organisers</option>
                        <option value="custom">Choose co-organisers</option>
                    </select>
                </label>
            </Show>
            <Show when={!inherits()}>
                <For each={others()}>
                    {(id, index) => (
                        <div class="co-organiser-row">
                            <input type="hidden" name="coOrganiserId" value={id} />
                            <span>
                                {choices().find((person) => person.id === id)?.name ??
                                    "Unavailable profile"}
                            </span>
                            <button
                                type="button"
                                class="button"
                                aria-label="Move organiser up"
                                disabled={index() === 0}
                                onClick={() => move(index(), -1)}
                            >
                                ↑
                            </button>
                            <button
                                type="button"
                                class="button"
                                aria-label="Move organiser down"
                                disabled={index() === others().length - 1}
                                onClick={() => move(index(), 1)}
                            >
                                ↓
                            </button>
                            <button
                                type="button"
                                class="button"
                                onClick={() => setOthers(others().filter((other) => other !== id))}
                            >
                                Remove
                            </button>
                        </div>
                    )}
                </For>
                <label>
                    {props.inherit ? "Add co-organiser" : "Co-organisers"}
                    <select
                        value=""
                        onChange={(event) => {
                            if (event.currentTarget.value)
                                setOthers([...others(), event.currentTarget.value]);
                            event.currentTarget.value = "";
                        }}
                    >
                        <option value="">Add co-organiser…</option>
                        <For
                            each={choices().filter(
                                (person) =>
                                    person.id !== primary() && !others().includes(person.id),
                            )}
                        >
                            {(person) => <option value={person.id}>{person.name}</option>}
                        </For>
                    </select>
                </label>
            </Show>
            <span>Public credits only. This does not grant editing access.</span>
        </div>
    );
}

/** Group public credits consistently in event and series editors. */
export function OrganiserCard(props: {
    value?: string;
    coOrganisers?: string[];
    inherit?: boolean;
}) {
    return (
        <Card title="Organisers">
            <OrganiserField
                value={props.value}
                coOrganisers={props.coOrganisers}
                inherit={props.inherit}
            />
        </Card>
    );
}
