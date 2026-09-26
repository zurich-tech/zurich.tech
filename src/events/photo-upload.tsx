import { For, Show, createSignal, onCleanup } from "solid-js";
import { memberClient } from "../auth/convex";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";
import "./editor.css";

type Selection = { file: File; url: string };

/** Preview selected event photographs before publishing optimised copies. */
export function PhotoUpload(props: { eventId: Id<"events">; saved: () => Promise<void> }) {
    const [selection, setSelection] = createSignal<Selection[]>([]);
    const [progress, setProgress] = createSignal<string>();
    const [error, setError] = createSignal<string>();
    const [isDragging, setIsDragging] = createSignal(false);
    let dragDepth = 0;
    let input!: HTMLInputElement;

    function clear() {
        selection().forEach((photo) => URL.revokeObjectURL(photo.url));
        setSelection([]);
        setError(undefined);
        input.value = "";
    }
    onCleanup(() => selection().forEach((photo) => URL.revokeObjectURL(photo.url)));

    /** Append valid files without losing an existing selection on a bad drop. */
    function choose(files: FileList | null) {
        if (progress()) return;
        const chosen = Array.from(files ?? []);
        input.value = "";
        if (!chosen.length) return;
        setError(undefined);
        if (
            chosen.some(
                (file) =>
                    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
                    file.size > 20000000,
            )
        ) {
            setError("Choose JPG, PNG or WebP photos, each under 20 MB.");
            return;
        }

        // retain each local file once when adding another batch
        const additions = chosen.filter(
            (file, index) =>
                ![...selection().map((photo) => photo.file), ...chosen.slice(0, index)].some(
                    (existing) =>
                        existing.name === file.name &&
                        existing.size === file.size &&
                        existing.lastModified === file.lastModified,
                ),
        );
        if (selection().length + additions.length > 10) {
            setError("Choose up to 10 photos at a time.");
            return;
        }
        setSelection((current) => [
            ...current,
            ...additions.map((file) => ({ file, url: URL.createObjectURL(file) })),
        ]);
    }

    async function publish() {
        if (progress()) return;
        setProgress("Preparing photos…");
        setError(undefined);
        const selected = [...selection()];
        try {
            const client = await memberClient();
            for (const [index, photo] of selected.entries()) {
                setProgress(`Uploading ${index + 1} of ${selected.length}…`);
                const bitmap = await createImageBitmap(photo.file);
                try {
                    const full = await resize(bitmap, 1600, 0.82);
                    const thumbnail = await resize(bitmap, 800, 0.78);
                    await client.action(api.events.photos.upload, {
                        eventId: props.eventId,
                        bytes: full.bytes,
                        thumbnail: thumbnail.bytes,
                        width: full.width,
                        height: full.height,
                    });
                } finally {
                    bitmap.close();
                }
                URL.revokeObjectURL(photo.url);
                setSelection((current) => current.filter((item) => item !== photo));
            }
            input.value = "";
        } catch (caught) {
            setError(
                errorMessage(
                    caught,
                    "Could not upload these photos. You can retry the remaining selection.",
                ),
            );
        } finally {
            setProgress(undefined);
            await props.saved();
        }
    }

    return (
        <div
            class="photo-upload"
            classList={{ "is-dragging": isDragging() }}
            onDragEnter={(event) => {
                if (!event.dataTransfer?.types.includes("Files")) return;
                event.preventDefault();
                dragDepth++;
                if (!progress()) setIsDragging(true);
            }}
            onDragOver={(event) => {
                if (!event.dataTransfer?.types.includes("Files")) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = progress() ? "none" : "copy";
            }}
            onDragLeave={() => {
                dragDepth = Math.max(0, dragDepth - 1);
                if (!dragDepth) setIsDragging(false);
            }}
            onDrop={(event) => {
                event.preventDefault();
                dragDepth = 0;
                setIsDragging(false);
                choose(event.dataTransfer?.files ?? null);
            }}
        >
            <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(event) => choose(event.currentTarget.files)}
            />
            <button
                class="photo-upload-zone"
                aria-label="Upload photos"
                disabled={!!progress()}
                type="button"
                onClick={() => input.click()}
            >
                <span>
                    {isDragging() ? "Drop photos here" : "Drag photos here or choose files"}
                </span>
                <small>
                    <span>JPG, PNG or WebP</span>
                    <span>Up to 10 photos · 20 MB each</span>
                </small>
            </button>
            <Show when={selection().length}>
                <div class="photo-upload-preview">
                    <For each={selection()}>
                        {(photo) => (
                            <figure>
                                <img src={photo.url} alt={photo.file.name} />
                                <button
                                    type="button"
                                    class="photo-upload-remove"
                                    aria-label={`Remove ${photo.file.name} from selection`}
                                    title="Remove from selection"
                                    disabled={!!progress()}
                                    onClick={() => {
                                        URL.revokeObjectURL(photo.url);
                                        setSelection((current) =>
                                            current.filter((item) => item !== photo),
                                        );
                                    }}
                                >
                                    <span aria-hidden="true">×</span>
                                </button>
                                <figcaption title={photo.file.name}>{photo.file.name}</figcaption>
                            </figure>
                        )}
                    </For>
                </div>
                <div class="photo-upload-actions" aria-live="polite">
                    <button
                        class="button button--primary"
                        type="button"
                        disabled={!!progress()}
                        onClick={publish}
                    >
                        {progress() ??
                            `Publish ${selection().length} ${selection().length === 1 ? "photo" : "photos"}`}
                    </button>
                    <button class="button" type="button" disabled={!!progress()} onClick={clear}>
                        Cancel
                    </button>
                </div>
            </Show>
            <FormMessage error={error()} />
        </div>
    );
}

/** Preserve aspect ratio while removing camera metadata from public images. */
async function resize(bitmap: ImageBitmap, bound: number, quality: number) {
    const scale = Math.min(1, bound / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
            (value) => (value ? resolve(value) : reject(new Error("Could not read this photo."))),
            "image/webp",
            quality,
        ),
    );
    return { bytes: await blob.arrayBuffer(), width: canvas.width, height: canvas.height };
}
