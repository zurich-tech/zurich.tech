import { For, Show, createSignal } from "solid-js";
import { FileText, Trash2, Upload } from "lucide-solid";
import { api } from "../../convex/_generated/api";
import { maximumMaterialBytes } from "../../convex/events/fields";
import type { Id } from "../../convex/_generated/dataModel";
import { memberClient } from "../auth/convex";
import { useAccess } from "../auth/edit";
import { Card } from "../components/card";
import { errorMessage } from "../components/errors";
import "./materials.css";

/** A published event document with its public storage URL. */
export type Material = { title: string; storageId: Id<"_storage">; url: string };

/** Open presentation documents without leaving the event screen. */
export function MaterialLinks(props: { materials: Material[] }) {
    return (
        <div class="event-material-links">
            <For each={props.materials}>
                {(material) => (
                    <a href={material.url} target="_blank" rel="external noopener noreferrer">
                        <FileText size={18} aria-hidden="true" />
                        <span>{material.title}</span>
                        <small>PDF</small>
                    </a>
                )}
            </For>
        </div>
    );
}

/** Publish and remove presentation PDFs from the event page. */
export function Materials(props: {
    eventId: Id<"events">;
    materials: Material[];
    saved: () => Promise<unknown>;
}) {
    const access = useAccess();
    const canManage = () =>
        !!access.current()?.isTeam ||
        !!access.current()?.isAdmin ||
        access.canEvent(props.eventId, "organiser");
    const [file, setFile] = createSignal<File>();
    const [title, setTitle] = createSignal("");
    const [isPending, setIsPending] = createSignal(false);
    const [error, setError] = createSignal<string>();
    let input!: HTMLInputElement;

    /** Publish the selected PDF after explicit confirmation of its public visibility. */
    async function upload(event: SubmitEvent) {
        event.preventDefault();
        const selected = file();
        if (!selected || isPending()) return;
        setIsPending(true);
        setError(undefined);
        try {
            const client = await memberClient();
            await client.action(api.events.materials.upload, {
                eventId: props.eventId,
                title: title(),
                bytes: await selected.arrayBuffer(),
            });
            setFile(undefined);
            setTitle("");
            input.value = "";
            await props.saved();
        } catch (caught) {
            setError(errorMessage(caught, "Could not publish this PDF."));
        } finally {
            setIsPending(false);
        }
    }

    /** Remove the selected document after confirmation. */
    async function remove(material: Material) {
        if (
            isPending() ||
            !window.confirm(`Remove ${material.title}? Its public file link will stop working.`)
        )
            return;
        setIsPending(true);
        setError(undefined);
        try {
            const client = await memberClient();
            await client.mutation(api.events.materials.remove, {
                eventId: props.eventId,
                storageId: material.storageId,
            });
            await props.saved();
        } catch (caught) {
            setError(errorMessage(caught, "Could not remove this PDF."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Show when={props.materials.length || canManage()}>
            <Card title="Materials" id="materials">
                <For each={props.materials}>
                    {(material) => (
                        <div class="event-material-row">
                            <MaterialLinks materials={[material]} />
                            <Show when={canManage()}>
                                <button
                                    type="button"
                                    class="action-link"
                                    title={`Remove ${material.title}`}
                                    aria-label={`Remove ${material.title}`}
                                    disabled={isPending()}
                                    onClick={() => remove(material)}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </Show>
                        </div>
                    )}
                </For>
                <Show when={canManage()}>
                    <form class="event-material-upload" onSubmit={upload}>
                        <label>
                            PDF
                            <input
                                ref={input}
                                type="file"
                                accept="application/pdf,.pdf"
                                disabled={isPending()}
                                onChange={(event) => {
                                    const selected = event.currentTarget.files?.[0];
                                    setError(undefined);
                                    setFile(undefined);
                                    if (!selected) return;
                                    if (
                                        selected.size > maximumMaterialBytes ||
                                        !selected.name.toLowerCase().endsWith(".pdf")
                                    ) {
                                        setError("Choose a PDF under 8 MB.");
                                        event.currentTarget.value = "";
                                        return;
                                    }
                                    setFile(selected);
                                    setTitle(selected.name.replace(/\.pdf$/i, ""));
                                }}
                            />
                        </label>
                        <Show when={file()}>
                            <label>
                                Title
                                <input
                                    required
                                    maxlength={100}
                                    value={title()}
                                    disabled={isPending()}
                                    onInput={(event) => setTitle(event.currentTarget.value)}
                                />
                            </label>
                            <button
                                class="button button--primary"
                                type="submit"
                                disabled={isPending() || !title().trim()}
                            >
                                <Upload size={16} />
                                {isPending() ? "Publishing…" : "Publish PDF"}
                            </button>
                        </Show>
                        <p class="text-soft">
                            Published PDFs are accessible to anyone with the link, without signing
                            in.
                        </p>
                    </form>
                </Show>
                <Show when={error()}>
                    <p role="alert">{error()}</p>
                </Show>
            </Card>
        </Show>
    );
}
