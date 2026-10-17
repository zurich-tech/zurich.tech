import { createEffect, createSignal, createUniqueId, For, Show } from "solid-js";
import { Textarea } from "./field";
import { Markdown } from "./markdown";
import "./markdown-editor.css";

/** Markdown input with selection formatting and the article's own preview renderer. */
export function MarkdownEditor(props: {
    label: string;
    value: string;
    name?: string;
    maxLength?: number;
    rows?: number;
    onChange?: (value: string) => void;
}) {
    const id = createUniqueId();
    const [isPreview, setIsPreview] = createSignal(false);
    const [preview, setPreview] = createSignal("");
    let textarea!: HTMLTextAreaElement;

    // follow externally loaded or saved revisions while previewing
    createEffect(() => setPreview(props.value));

    /** Format the selected text, then restore focus and keep the content selected. */
    function format(before: string, after: string, placeholder: string) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = textarea.value.slice(start, end) || placeholder;
        textarea.setRangeText(before + selected + after, start, end, "select");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        textarea.focus();
        textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }

    return (
        <div class="markdown-editor" style={{ "--markdown-rows": props.rows ?? 12 }}>
            <label class="field__label" for={id}>
                {props.label}
            </label>
            <div
                class="markdown-editor__tools"
                role="group"
                aria-label={`${props.label} formatting`}
            >
                <Show when={!isPreview()}>
                    <For
                        each={
                            [
                                ["Bold", "**", "**", "text"],
                                ["Italic", "_", "_", "text"],
                                ["Heading", "\n\n## ", "\n", "Heading"],
                                ["List", "\n- ", "\n", "Item"],
                                ["Quote", "\n> ", "\n", "Quote"],
                                ["Code", "`", "`", "code"],
                                ["Link", "[", "](https://)", "Link text"],
                            ] as const
                        }
                    >
                        {([label, before, after, placeholder]) => (
                            <button
                                type="button"
                                class="action-link"
                                onPointerDown={(event) => event.preventDefault()}
                                onClick={() => format(before, after, placeholder)}
                            >
                                {label}
                            </button>
                        )}
                    </For>
                </Show>
                <button
                    type="button"
                    class="action-link markdown-editor__toggle"
                    onClick={() => {
                        setPreview(textarea.value);
                        setIsPreview(!isPreview());
                    }}
                >
                    {isPreview() ? "Write" : "Preview"}
                </button>
            </div>
            <Textarea
                id={id}
                ref={textarea}
                hidden={isPreview()}
                name={props.name}
                rows={props.rows ?? 12}
                maxLength={props.maxLength ?? 50000}
                value={props.value}
                aria-describedby={`${id}-hint`}
                onInput={(event) => props.onChange?.(event.currentTarget.value)}
                onKeyDown={(event) => {
                    // keep familiar formatting shortcuts within the writing field
                    if (
                        (event.metaKey || event.ctrlKey) &&
                        !event.altKey &&
                        ["b", "i"].includes(event.key.toLowerCase())
                    ) {
                        event.preventDefault();
                        const marker = event.key.toLowerCase() === "b" ? "**" : "_";
                        format(marker, marker, "text");
                    }
                }}
            />
            <Show when={isPreview()}>
                <div
                    class="markdown-editor__preview article-content"
                    role="region"
                    aria-label={`${props.label} preview`}
                >
                    <Show
                        when={preview().trim()}
                        fallback={<p class="markdown-editor__hint">Nothing to preview yet.</p>}
                    >
                        <Markdown source={preview()} />
                    </Show>
                </div>
            </Show>
            <small id={`${id}-hint`} class="markdown-editor__hint">
                Markdown supported. Select text to format it.
            </small>
        </div>
    );
}
