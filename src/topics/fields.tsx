import { getTopics } from "./queries";
import { createAsync } from "@solidjs/router";
import { createEffect, createSignal, For, Show } from "solid-js";
import "./topics.css";

/** Select curated topics; preserve selected values while the catalogue loads. */
export function TopicFields(props: {
    values: string[];
    name?: string;
    label?: string;
    onChange?: (values: string[]) => void;
}) {
    const topics = createAsync(() => getTopics());
    const [selected, setSelected] = createSignal(props.values);
    createEffect(() => setSelected(props.values));
    const update = (slug: string, checked: boolean) => {
        const values = checked
            ? [...selected(), slug]
            : selected().filter((value) => value !== slug);
        setSelected(values);
        props.onChange?.(values);
    };

    return (
        <fieldset class="topic-fields">
            <legend>{props.label ?? "Topics"}</legend>
            <For each={selected()}>
                {(value) => <input type="hidden" name={props.name ?? "topic"} value={value} />}
            </For>
            <Show when={topics()} fallback={<p role="status">Loading topics…</p>}>
                <div class="choice-grid">
                    <For
                        each={topics()?.filter(
                            (topic) => topic.isActive || selected().includes(topic.slug),
                        )}
                    >
                        {(topic) => (
                            <label class="checkbox">
                                <input
                                    type="checkbox"
                                    checked={selected().includes(topic.slug)}
                                    onChange={(event) =>
                                        update(topic.slug, event.currentTarget.checked)
                                    }
                                />
                                {topic.name}
                                {topic.isActive ? "" : " (archived)"}
                            </label>
                        )}
                    </For>
                </div>
            </Show>
        </fieldset>
    );
}
