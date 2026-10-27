import { For, Show, type JSX } from "solid-js";
import { AudienceChart } from "../members/chart";
import { Card } from "../components/card";
import { Arrow } from "../components/arrow";
import { getAudience } from "./queries";
import "./style.css";

/** Ordered distributions shared by the sponsor overview and the full report. */
const highlights = [
    "interests",
    "roles",
    "motivations",
    "experience",
    "eventKinds",
    "participation",
];

/** Show public survey distributions without exposing absolute response counts. */
export function CommunityAudience(props: { compact?: boolean; children?: JSX.Element }) {
    const questions = getAudience.use(() => []);
    const selected = () => highlights.slice(0, props.compact ? 3 : 6);
    const visible = () => {
        const report = questions() ?? [];
        const first = selected().flatMap((field) =>
            report.filter((question) => question.field === field),
        );

        return props.compact
            ? first
            : [...first, ...report.filter((question) => !selected().includes(question.field))];
    };

    return (
        <Card
            id="audience"
            title={props.compact ? "Audience" : "Survey results"}
            class="community-audience"
            toolbar={
                <Show when={props.compact}>
                    <a class="action-link" href="/stats#audience">
                        All survey results <Arrow />
                    </a>
                </Show>
            }
        >
            {props.children}
            <p class="audience-caption">
                Among survey respondents.{" "}
                {props.compact
                    ? "Leading responses; multiple choices allowed."
                    : "Multiple choices where applicable."}
            </p>
            <Show when={questions()}>
                <div
                    class="audience-charts"
                    classList={{ "audience-charts--compact": props.compact }}
                >
                    <For each={visible()}>
                        {(question) => (
                            <AudienceChart
                                {...question}
                                hideCounts
                                limit={7}
                                expandable={!props.compact}
                                showQuestion={!props.compact}
                            />
                        )}
                    </For>
                </div>
            </Show>
        </Card>
    );
}
