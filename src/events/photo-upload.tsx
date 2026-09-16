import { For, Show, createSignal, onCleanup } from "solid-js";
import { memberClient } from "../auth/convex";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";

type Selection = { file: File; url: string };

/** Preview selected event photographs before publishing optimised copies. */
export function PhotoUpload(props: { eventId: Id<"events">; saved: () => Promise<void> }) {
    const [selection, setSelection] = createSignal<Selection[]>([]);
    const [progress, setProgress] = createSignal<string>();
    const [error, setError] = createSignal<string>();
    let input!: HTMLInputElement;

    function clear() {
        selection().forEach((photo) => URL.revokeObjectURL(photo.url));
        setSelection([]);
        input.value = "";
    }
    onCleanup(() => selection().forEach((photo) => URL.revokeObjectURL(photo.url)));

    function choose(files: FileList | null) {
        const chosen = Array.from(files ?? []);
        clear();
        setError(undefined);
        if (!chosen.length) return;
        if (
            chosen.length > 10 ||
            chosen.some(
                (file) =>
                    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
                    file.size > 20000000,
            )
        ) {
            setError("Choose up to 10 JPG, PNG or WebP photos, each under 20 MB.");
            return;
        }
        setSelection(chosen.map((file) => ({ file, url: URL.createObjectURL(file) })));
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
        <div class="photo-upload">
            <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(event) => choose(event.currentTarget.files)}
            />
            <button
                class="action-link"
                disabled={!!progress()}
                type="button"
                onClick={() => input.click()}
            >
                Upload photos
            </button>
            <Show when={selection().length}>
                <div class="photo-upload-preview">
                    <For each={selection()}>
                        {(photo) => (
                            <figure>
                                <img src={photo.url} alt={photo.file.name} />
                                <button
                                    type="button"
                                    class="action-link"
                                    disabled={!!progress()}
                                    onClick={() => {
                                        URL.revokeObjectURL(photo.url);
                                        setSelection((current) =>
                                            current.filter((item) => item !== photo),
                                        );
                                    }}
                                >
                                    Remove from selection
                                </button>
                            </figure>
                        )}
                    </For>
                </div>
                <div class="form-actions">
                    <button
                        class="button button--primary"
                        type="button"
                        disabled={!!progress()}
                        onClick={publish}
                    >
                        {progress() ?? `Publish ${selection().length} photos`}
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
