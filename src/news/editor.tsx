import { civilTime } from "../events/time";
import { TopicFields } from "../topics/fields";
import { FormSection } from "../components/form";
import { useUnsavedChanges } from "../components/unsaved";
import { createSignal, For, Show } from "solid-js";
import { useNavigate, useSearchParams, revalidate } from "@solidjs/router";
import type { FunctionReturnType } from "convex/server";
import type { Doc } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { Card } from "../components/card";
import { Field, Input, Textarea, Select } from "../components/field";
import { FormMessage } from "../components/form";
import { Dialog, useConfirmation } from "../components/dialog";
import { Markdown } from "../components/markdown";
import { MarkdownEditor } from "../components/markdown-editor";
import { errorMessage } from "../components/errors";
import { SocialCopy } from "./social";
import { getArticles, getArticle } from "./queries";
import "./article.css";

type Content = Doc<"posts">["draft"];

/** Save drafts and publish their exact preview as separate explicit actions. */
export function NewsEditor(props: {
    workspace: FunctionReturnType<typeof api.news.queries.workspace>;
    id?: string;
    kind: "post" | "link";
    onSave: () => Promise<unknown>;
}) {
    const initial = props.workspace.posts.find((post) => post._id === props.id);
    const [id, setId] = createSignal(initial?._id);
    const [version, setVersion] = createSignal(initial?.updatedAt);
    const [published, setPublished] = createSignal(
        initial?.published
            ? { ...initial.published, date: initial.published.date ?? initial.publishedAt }
            : undefined,
    );
    const [hasPublished, setHasPublished] = createSignal(!!initial?.publishedAt);
    const [slug, setSlug] = createSignal(initial?.slug ?? "");
    const [content, setContent] = createSignal<Content>(
        initial?.draft ?? {
            kind: props.kind,
            title: "",
            description: "",
            body: "",
            topics: [],
            authors: [],
            organisations: [],
        },
    );
    const [date, setDate] = createSignal(
        civilTime(initial?.draft.date ?? initial?.publishedAt ?? Date.now()).slice(0, 10),
    );
    const isDateValid = () => !!date() && Number.isFinite(Date.parse(`${date()}T00:00:00Z`));
    const draftContent = () => ({
        ...content(),
        date: content().date ?? initial?.publishedAt ?? Date.parse(`${date()}T00:00:00Z`),
    });
    const snapshot = () => JSON.stringify({ slug: slug(), date: date(), content: draftContent() });
    const [isPreview, setIsPreview] = createSignal(false);
    const [isPending, setIsPending] = createSignal(false);
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();
    const [saved, setSaved] = createSignal(snapshot());
    const isDirty = () => saved() !== snapshot();
    useUnsavedChanges(isDirty);
    const confirm = useConfirmation();
    const navigate = useNavigate();
    const [, setParams] = useSearchParams();
    const update = <K extends keyof Content>(key: K, value: Content[K]) => {
        setContent((current) => ({ ...current, [key]: value }));
        setSuccess(undefined);
        setError(undefined);
    };

    /** Persist only the draft; preserve the currently published content. */
    async function save() {
        if (!isDateValid()) throw new Error("Enter a valid news date.");
        const submitted = snapshot();
        const result = await (
            await memberClient()
        ).mutation(api.news.mutations.save, {
            id: id(),
            slug: slug(),
            content: draftContent(),
            expectedUpdatedAt: version(),
        });
        setId(result.id);
        setVersion(result.updatedAt);
        setSaved(submitted);
        await props.onSave();
        setParams({ id: result.id }, { replace: true });
        return result;
    }
    async function run(action: () => Promise<void>) {
        if (isPending()) return;
        setIsPending(true);
        setError(undefined);
        setSuccess(undefined);
        try {
            await action();
        } catch (caught) {
            setError(errorMessage(caught, "Could not save news."));
        } finally {
            setIsPending(false);
        }
    }
    async function publish(isPublished: boolean) {
        if (isPublished && !isDateValid()) {
            setError("Enter a valid news date.");
            return;
        }

        if (
            !(await confirm({
                title: isPublished
                    ? published()
                        ? "Publish changes"
                        : "Publish news"
                    : "Unpublish news",
                action: isPublished ? "Publish" : "Unpublish",
                description: isPublished
                    ? "Make this version public. No emails or social posts will be sent."
                    : "Remove this entry from the public feed. No emails or social posts will be sent.",
                isDestructive: !isPublished,
            }))
        )
            return;
        await run(async () => {
            const draft = isPublished ? await save() : { id: id()!, updatedAt: version()! };
            const result = await (
                await memberClient()
            ).mutation(api.news.mutations.publish, {
                id: draft.id,
                isPublished,
                expectedUpdatedAt: draft.updatedAt,
            });
            setVersion(result.updatedAt);
            setPublished(isPublished ? draftContent() : undefined);
            if (isPublished) setHasPublished(true);
            await revalidate([getArticles.key, getArticle.key]);
            navigate("/admin?section=news");
        });
    }
    function back() {
        navigate("/admin?section=news");
    }
    const actions = () => (
        <>
            <button type="button" class="button" disabled={isPending()} onClick={back}>
                Back
            </button>
            <button type="submit" class="button button--primary" disabled={isPending()}>
                {isPending() ? "Saving…" : "Save"}
            </button>
        </>
    );
    return (
        <>
            <form
                inert={isPending()}
                aria-busy={isPending()}
                onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                        await save();
                        setSuccess("Saved.");
                    });
                }}
            >
                <Card
                    title={id() ? "Edit news" : content().kind === "link" ? "Add link" : "New post"}
                    heading="h1"
                    toolbar={
                        <>
                            {actions()}
                            <span
                                class="tag status-control"
                                classList={{ "tag-upcoming": !!published() }}
                            >
                                {published() ? "Published" : "Draft"}
                            </span>
                        </>
                    }
                >
                    <FormMessage error={error()} success={success()} />
                    <fieldset class="news-editor-fields" disabled={isPending()}>
                        <Show
                            when={
                                published() &&
                                JSON.stringify(draftContent()) !== JSON.stringify(published())
                            }
                        >
                            <span class="tag tag-status">Unpublished changes</span>
                        </Show>
                        <Field label="Title">
                            <Input
                                required
                                maxLength={200}
                                value={content().title}
                                onInput={(event) => update("title", event.currentTarget.value)}
                            />
                        </Field>
                        <div class="news-editor-grid">
                            <Field label="Slug">
                                <Input
                                    required
                                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                                    readOnly={hasPublished()}
                                    value={slug()}
                                    onInput={(event) => setSlug(event.currentTarget.value)}
                                />
                            </Field>
                            <Field label="Type">
                                <Select
                                    value={content().kind}
                                    onChange={(event) =>
                                        update("kind", event.currentTarget.value as Content["kind"])
                                    }
                                >
                                    <option value="post">Post</option>
                                    <option value="link">Link</option>
                                </Select>
                            </Field>
                        </div>
                        <Show when={content().kind === "link"}>
                            <Field label="Original URL">
                                <Input
                                    type="url"
                                    required
                                    value={content().url ?? ""}
                                    onInput={(event) => update("url", event.currentTarget.value)}
                                />
                            </Field>
                        </Show>
                        <div class="news-editor-grid">
                            <Field label="Date">
                                <Input
                                    type="date"
                                    value={date()}
                                    required
                                    onInput={(event) => {
                                        setDate(event.currentTarget.value);
                                        const selected = event.currentTarget.valueAsNumber;
                                        if (Number.isFinite(selected)) update("date", selected);
                                    }}
                                />
                                <small class="text-soft">
                                    Shown on the article and used to order the news feed. Publish
                                    changes to apply it.
                                </small>
                            </Field>
                            <Field label="Category">
                                <Select
                                    value={content().category ?? ""}
                                    onChange={(event) =>
                                        update(
                                            "category",
                                            event.currentTarget.value === "funding"
                                                ? "funding"
                                                : undefined,
                                        )
                                    }
                                >
                                    <option value="">General news</option>
                                    <option value="funding">Funding</option>
                                </Select>
                            </Field>
                        </div>
                        <Field label="Summary">
                            <Textarea
                                rows={2}
                                maxLength={500}
                                value={content().description}
                                onInput={(event) =>
                                    update("description", event.currentTarget.value)
                                }
                            />
                        </Field>
                        <MarkdownEditor
                            label={content().kind === "link" ? "Commentary" : "Body"}
                            value={content().body}
                            onChange={(value) => update("body", value)}
                        />
                        <div class="news-editor-grid">
                            <Field label="Image URL">
                                <Input
                                    type="url"
                                    value={content().image ?? ""}
                                    onInput={(event) =>
                                        update("image", event.currentTarget.value || undefined)
                                    }
                                />
                            </Field>
                            <TopicFields
                                values={content().topics}
                                onChange={(values) => update("topics", values)}
                            />
                        </div>
                        <FormSection title="Authors">
                            <div class="news-options">
                                <For each={props.workspace.members}>
                                    {(member) => (
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={content().authors.includes(member.id)}
                                                onChange={(event) =>
                                                    update(
                                                        "authors",
                                                        event.currentTarget.checked
                                                            ? [...content().authors, member.id]
                                                            : content().authors.filter(
                                                                  (id) => id !== member.id,
                                                              ),
                                                    )
                                                }
                                            />
                                            {member.name}
                                        </label>
                                    )}
                                </For>
                            </div>
                        </FormSection>
                        <FormSection title="Organisations">
                            <div class="news-options">
                                <For each={props.workspace.organisations}>
                                    {(organisation) => (
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={content().organisations.includes(
                                                    organisation.id,
                                                )}
                                                onChange={(event) =>
                                                    update(
                                                        "organisations",
                                                        event.currentTarget.checked
                                                            ? [
                                                                  ...content().organisations,
                                                                  organisation.id,
                                                              ]
                                                            : content().organisations.filter(
                                                                  (id) => id !== organisation.id,
                                                              ),
                                                    )
                                                }
                                            />
                                            {organisation.name}
                                        </label>
                                    )}
                                </For>
                            </div>
                        </FormSection>
                        <div class="news-actions">
                            {actions()}
                            <button type="button" class="button" onClick={() => setIsPreview(true)}>
                                Preview
                            </button>
                            <button
                                type="button"
                                class="button button--primary"
                                disabled={isPending()}
                                onClick={() => publish(true)}
                            >
                                {published() ? "Publish changes" : "Publish"}
                            </button>
                            <Show when={published()}>
                                <button
                                    type="button"
                                    class="button"
                                    disabled={isPending()}
                                    onClick={() => publish(false)}
                                >
                                    Unpublish
                                </button>
                            </Show>
                            <Show when={id() && !hasPublished()}>
                                <button
                                    type="button"
                                    class="button"
                                    disabled={isPending()}
                                    onClick={async () => {
                                        if (
                                            await confirm({
                                                title: "Delete draft",
                                                action: "Delete",
                                                description: "Permanently delete this draft?",
                                                isDestructive: true,
                                            })
                                        )
                                            await run(async () => {
                                                await (
                                                    await memberClient()
                                                ).mutation(api.news.mutations.remove, {
                                                    id: id()!,
                                                    expectedUpdatedAt: version()!,
                                                });
                                                setSaved(snapshot());
                                                navigate("/admin?section=news");
                                            });
                                    }}
                                >
                                    Delete
                                </button>
                            </Show>
                        </div>
                    </fieldset>
                </Card>
            </form>
            <Dialog
                isOpen={isPreview()}
                title={content().title || "Preview"}
                onClose={() => setIsPreview(false)}
                actions={
                    <button class="button" onClick={() => setIsPreview(false)}>
                        Close
                    </button>
                }
            >
                <Show when={content().image}>
                    <img class="news-image" src={content().image} alt="" />
                </Show>
                <p>{content().description}</p>
                <Markdown source={content().body} />
                <Show when={content().kind === "link" && content().url}>
                    <a
                        class="action-link"
                        href={content().url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Read original
                    </a>
                </Show>
            </Dialog>
            <Show when={published()}>
                {(post) => (
                    <SocialCopy
                        title={post().title}
                        description={post().description}
                        url={`https://zurich.tech/news/${slug()}`}
                    />
                )}
            </Show>
        </>
    );
}
