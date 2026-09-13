import "./article.css";
import { createSignal } from "solid-js";
import { Card } from "../components/card";
import { Field, Textarea } from "../components/field";
import { FormMessage } from "../components/form";

/** Prepare editable social copy; copying never publishes it. */
export function SocialCopy(props: { title: string; description: string; url: string }) {
    const [text, setText] = createSignal(
        [props.title, props.description, props.url].filter(Boolean).join("\n\n"),
    );
    const [message, setMessage] = createSignal<string>();
    const [error, setError] = createSignal<string>();
    async function copy(network: string) {
        try {
            await navigator.clipboard.writeText(text());
            setError(undefined);
            setMessage(`Copied for ${network}.`);
        } catch {
            setError("Could not copy. Select and copy the text above.");
        }
    }
    return (
        <Card title="Share">
            <Field label="Text">
                <Textarea
                    rows={5}
                    value={text()}
                    onInput={(event) => {
                        setText(event.currentTarget.value);
                        setMessage(undefined);
                    }}
                />
            </Field>
            <div class="news-actions">
                <button class="button" onClick={() => copy("LinkedIn")}>
                    Copy for LinkedIn
                </button>
                <button class="button" onClick={() => copy("Twitter")}>
                    Copy for Twitter
                </button>
            </div>
            <FormMessage success={message()} error={error()} />
        </Card>
    );
}
