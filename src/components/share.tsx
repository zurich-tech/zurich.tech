import { createSignal, onMount, Show } from "solid-js";
import linkedin from "./assets/social/linkedin.svg?raw";
import x from "./assets/social/x.svg?raw";
import { Card } from "./card";
import { Input } from "./field";

/** Share a public page through a chosen destination or the device share sheet. */
export function Share(props: { title: string; url: string }) {
    const [isNative, setIsNative] = createSignal(false);
    const [message, setMessage] = createSignal("");
    const [isManual, setIsManual] = createSignal(false);
    onMount(() => setIsNative(typeof navigator.share === "function"));

    /** Copy the canonical link, exposing a selectable fallback if clipboard access fails. */
    async function copy() {
        try {
            await navigator.clipboard.writeText(props.url);
            setIsManual(false);
            setMessage("Link copied.");
        } catch {
            setIsManual(true);
            setMessage("Select and copy the link below.");
        }
    }

    /** Open the device share sheet without treating cancellation as a failure. */
    async function share() {
        try {
            await navigator.share({ title: props.title, url: props.url });
        } catch (error) {
            if (!(error instanceof DOMException && error.name === "AbortError")) {
                setMessage("Sharing is unavailable. You can copy the link instead.");
            }
        }
    }

    return (
        <Card title="Share">
            <div class="share-actions">
                <button type="button" class="action-link" onClick={copy}>
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        aria-hidden="true"
                    >
                        <rect x="8" y="8" width="12" height="12" rx="2" />
                        <path d="M16 8V4H4v12h4" />
                    </svg>
                    Copy link
                </button>
                <a
                    class="action-link"
                    href={`https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url: props.url })}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <span class="share-icon" aria-hidden="true" innerHTML={linkedin} />
                    LinkedIn
                </a>
                <a
                    class="action-link"
                    href={`https://x.com/intent/tweet?${new URLSearchParams({ text: props.title, url: props.url })}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <span class="share-icon" aria-hidden="true" innerHTML={x} />
                    Twitter
                </a>
                <a
                    class="action-link"
                    href={`mailto:?subject=${encodeURIComponent(props.title)}&body=${encodeURIComponent(`${props.title}\n${props.url}`)}`}
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        aria-hidden="true"
                    >
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="m3 6 9 7 9-7" />
                    </svg>
                    Email
                </a>
                <Show when={isNative()}>
                    <button type="button" class="action-link share-more" onClick={share}>
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            aria-hidden="true"
                        >
                            <path d="M12 16V3m-5 5 5-5 5 5M5 12v9h14v-9" />
                        </svg>
                        More…
                    </button>
                </Show>
            </div>
            <Show when={message()}>
                <p class="text-sm text-soft" role="status">
                    {message()}
                </p>
            </Show>
            <Show when={isManual()}>
                <Input
                    aria-label="Link to share"
                    readonly
                    value={props.url}
                    onFocus={(event) => event.currentTarget.select()}
                />
            </Show>
        </Card>
    );
}
