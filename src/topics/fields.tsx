import { interestGroups, excludedInterests } from "./groups";
import { getTopics } from "./queries";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import "./topics.css";

/** Select curated topics; preserve selected values while the catalogue loads. */
export function TopicFields(props: {
    values: string[];
    isInterests?: boolean;
    name?: string;
    label?: string;
    onChange?: (values: string[]) => void;
}) {
    const topics = getTopics.use(() => []);
    const [selected, setSelected] = createSignal(props.values);
    createEffect(() => setSelected(props.values));
    const update = (slug: string, checked: boolean) => {
        const values = checked
            ? [...selected(), slug]
            : selected().filter((value) => value !== slug);
        setSelected(values);
        props.onChange?.(values);
    };

    // resolve catalogue entries once, keeping rendering independent of slug lookup details
    const groups = createMemo(() => {
        const available = (topics() ?? []).filter(
            (topic) => topic.isActive || props.values.includes(topic.slug),
        );
        if (!props.isInterests) return [{ name: "", entries: available }];
        const grouped = interestGroups.map((group) => ({
            name: group.name,
            entries: available
                .filter((topic) => group.topics.includes(topic.slug))
                .sort((a, b) => group.topics.indexOf(a.slug) - group.topics.indexOf(b.slug)),
        }));
        const other = available.filter(
            (topic) =>
                !interestGroups.some((group) => group.topics.includes(topic.slug)) &&
                !excludedInterests.includes(topic.slug),
        );
        return [...grouped, { name: "More", entries: other }].filter(
            (group) => group.entries.length,
        );
    });

    return (
        <fieldset class="topic-fields">
            <legend>{props.label ?? "Topics"}</legend>
            <For each={selected()}>
                {(value) => <input type="hidden" name={props.name ?? "topic"} value={value} />}
            </For>
            <Show when={topics()} fallback={<p role="status">Loading topics…</p>}>
                <div classList={{ "interest-groups": props.isInterests }}>
                    <For each={groups()}>
                        {(group) => (
                            <div class="interest-group">
                                <div class="choice-grid">
                                    <For each={group.entries}>
                                        {(topic) => (
                                            <label class="checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={selected().includes(topic.slug)}
                                                    onChange={(event) =>
                                                        update(
                                                            topic.slug,
                                                            event.currentTarget.checked,
                                                        )
                                                    }
                                                />
                                                {topic.name}
                                                {topic.isActive ? "" : " (archived)"}
                                            </label>
                                        )}
                                    </For>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </Show>
        </fieldset>
    );
}
