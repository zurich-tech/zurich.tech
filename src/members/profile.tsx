import { MarkdownEditor } from "../components/markdown-editor";
import { AffiliationFields, readAffiliations } from "./affiliations";
import {
    Suspense,
    startTransition,
    createResource,
    createSignal,
    Show,
    For,
    onCleanup,
} from "solid-js";
import { auth } from "../auth";
import { Avatar } from "../components/avatar";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { errorMessage } from "../components/errors";
import { Card } from "../components/card";
import { savedEditor, Editor, FormMessage } from "../components/form";
import { ProfileLinkFields } from "../components/social";
import "./profile.css";

/** Edit the member profile independently of purchasing a tier. */
export function ProfileSettings() {
    const [profile, { refetch }] = createResource(async () =>
        (await memberClient()).query(api.members.profiles.current, {}),
    );
    const [providers] = createResource(async () => {
        const result = await auth.listAccounts();
        if (result.error)
            throw new Error(result.error.message ?? "Could not load sign-in providers.");
        return (
            result.data?.filter(
                (item) => item.providerId === "github" || item.providerId === "google",
            ) ?? []
        );
    });
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    const [photo, setPhoto] = createSignal<string>();

    const [slug, setSlug] = createSignal<string>();
    const [candidate, setCandidate] = createSignal<string>();
    let slugTimer: ReturnType<typeof setTimeout> | undefined;
    onCleanup(() => clearTimeout(slugTimer));
    // keep availability feedback local to the slug field
    const [availability] = createResource(
        candidate,
        async (handle) => {
            if (!/^[a-z][a-z0-9-]{2,39}$/.test(handle)) {
                return {
                    isAvailable: false,
                    error: "Use 3–40 letters, numbers or hyphens, starting with a letter.",
                };
            }
            try {
                const result = await (
                    await memberClient()
                ).query(api.members.profiles.available, { handle });
                return { ...result, error: "" };
            } catch (caught) {
                return {
                    isAvailable: false,
                    error: errorMessage(caught, "Could not check availability."),
                };
            }
        },
        { initialValue: { isAvailable: true, error: "" } },
    );
    /** Normalize the handle and schedule its availability check. */
    function checkSlug(value: string) {
        setSlug(value.trim().toLowerCase());
        setCandidate(undefined);
        clearTimeout(slugTimer);
        slugTimer = setTimeout(() => setCandidate(value.trim().toLowerCase() || undefined), 300);
    }

    /** Resize and square-crop a chosen image before uploading it. */
    async function uploadPhoto(file?: File) {
        if (!file) return;
        setIsPending(true);
        setError(undefined);
        setSuccess(undefined);
        try {
            if (
                !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
                file.size > 10000000
            )
                throw new Error("Choose a JPG, PNG or WebP image under 10 MB.");
            const bitmap = await createImageBitmap(file);
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 512;
            const size = Math.min(bitmap.width, bitmap.height);
            canvas
                .getContext("2d")!
                .drawImage(
                    bitmap,
                    (bitmap.width - size) / 2,
                    (bitmap.height - size) / 2,
                    size,
                    size,
                    0,
                    0,
                    512,
                    512,
                );
            bitmap.close();
            const blob = await new Promise<Blob>((resolve, reject) =>
                canvas.toBlob(
                    (blob) =>
                        blob ? resolve(blob) : reject(new Error("Could not read this image.")),
                    "image/webp",
                    0.85,
                ),
            );
            await (
                await memberClient()
            ).action(api.members.avatars.upload, { bytes: await blob.arrayBuffer() });
            // refresh the portrait independently so an upload cannot replace unsaved profile fields
            const updated = await (await memberClient()).query(api.members.profiles.current, {});
            setPhoto(updated?.avatarUrl);
            setSuccess("Photo updated.");
        } catch (caught) {
            setError(errorMessage(caught, "Could not upload your photo."));
        } finally {
            setIsPending(false);
        }
    }

    /** Validate and save the signed-in member's destinations. */
    async function save(event: SubmitEvent) {
        event.preventDefault();
        const editor = event.currentTarget as HTMLFormElement;
        const fields = new FormData(event.currentTarget as HTMLFormElement);
        const text = (key: string) => String(fields.get(key) ?? "").trim() || undefined;
        setIsPending(true);
        setError(undefined);
        setSuccess(undefined);
        try {
            await (
                await memberClient()
            ).mutation(api.members.profiles.save, {
                name: text("name") ?? "",
                handle: text("handle"),
                isPublic: fields.has("isPublic"),
                headline: text("headline"),
                affiliations: readAffiliations(fields.get("affiliations")),
                bio: text("bio"),
                profileUrl: text("profileUrl"),
                socials: { linkedin: text("linkedin"), github: text("github"), x: text("x") },
            });
            setSlug(undefined);
            setCandidate(undefined);
            await startTransition(refetch);
            savedEditor(editor);
            setSuccess("Profile saved.");
        } catch (caught) {
            setError(errorMessage(caught, "Could not save profile."));
        } finally {
            setIsPending(false);
        }
    }

    /** Fetch the selected provider's current photo without changing the rest of the profile. */
    async function refreshPhoto(accountId: string, providerId: string) {
        setIsPending(true);
        setError(undefined);
        setSuccess(undefined);
        try {
            const result = await auth.accountInfo({ query: { accountId, providerId } });
            if (result.error)
                throw new Error("Sign in with this provider again, then refresh your photo.");
            const image = result.data?.user.image;
            if (!image) throw new Error("This provider has no profile photo.");
            await (await memberClient()).mutation(api.members.profiles.refreshPhoto, { image });
            await startTransition(refetch);
            setSuccess("Photo refreshed.");
        } catch (caught) {
            setError(errorMessage(caught, "Could not refresh your photo."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Card
            title="Profile"
            toolbar={
                <Suspense>
                    <Show when={profile.latest}>
                        <button
                            type="submit"
                            form="profile-editor"
                            class="button button--primary"
                            disabled={
                                isPending() ||
                                availability.loading ||
                                (!!candidate() && availability.latest?.isAvailable === false)
                            }
                        >
                            {isPending() ? "Saving…" : "Save"}
                        </button>
                    </Show>
                </Suspense>
            }
        >
            <Show when={profile.error}>
                <p class="form-error">{errorMessage(profile.error, "Could not load profile.")}</p>
            </Show>
            <Show when={profile()}>
                {(current) => (
                    <Editor
                        id="profile-editor"
                        inert={isPending()}
                        class="editor profile-editor"
                        onSubmit={save}
                        actions={() => (
                            <div class="form-actions">
                                <button
                                    class="button button--primary"
                                    disabled={
                                        isPending() ||
                                        availability.loading ||
                                        (!!candidate() &&
                                            availability.latest?.isAvailable === false)
                                    }
                                >
                                    {isPending() ? "Saving…" : "Save"}
                                </button>
                                <Show when={current().visibility === "public" && current().handle}>
                                    <a class="action-link" href={`/members/${current().handle}`}>
                                        View profile
                                    </a>
                                </Show>
                            </div>
                        )}
                    >
                        <div class="profile-photo">
                            <Avatar
                                name={current().name}
                                image={photo() ?? current().avatarUrl}
                                imageDark={photo() ? undefined : current().avatarDarkUrl}
                            />
                            <div class="row-actions">
                                <label class="button avatar-upload">
                                    Upload photo
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        disabled={isPending()}
                                        onChange={(event) => {
                                            void uploadPhoto(event.currentTarget.files?.[0]);
                                            event.currentTarget.value = "";
                                        }}
                                    />
                                </label>
                                <For each={providers()}>
                                    {(provider) => (
                                        <button
                                            class="button"
                                            type="button"
                                            disabled={isPending()}
                                            onClick={() =>
                                                refreshPhoto(
                                                    provider.accountId,
                                                    provider.providerId,
                                                )
                                            }
                                        >
                                            Refresh from{" "}
                                            {provider.providerId === "github" ? "GitHub" : "Google"}
                                        </button>
                                    )}
                                </For>
                                <Show when={providers()?.length === 0}>
                                    <p class="text-soft">
                                        Sign in with Google or GitHub to import a profile photo.
                                    </p>
                                </Show>
                                <Show when={providers.error}>
                                    <p class="form-error">Could not load photo providers.</p>
                                </Show>
                            </div>
                        </div>
                        <div class="form-columns">
                            <label>
                                Name
                                <input
                                    name="name"
                                    maxlength="120"
                                    required
                                    value={current().name}
                                    autocomplete="name"
                                />
                            </label>
                            <label>
                                Email
                                <input type="email" value={current().email} readonly />
                            </label>
                        </div>
                        <hr class="profile-divider" />
                        <label>
                            Headline
                            <input
                                name="headline"
                                maxlength="160"
                                placeholder="A short introduction"
                                value={current().headline ?? ""}
                            />
                        </label>
                        <AffiliationFields
                            title="Affiliations"
                            name="affiliations"
                            values={current().affiliations}
                        />
                        <MarkdownEditor
                            label="Bio"
                            name="bio"
                            maxLength={1000}
                            rows={3}
                            value={current().bio ?? ""}
                        />
                        <div class="profile-address">
                            <label>
                                Profile address (optional)
                                <input
                                    name="handle"
                                    aria-label="Profile address"
                                    autocomplete="off"
                                    autocapitalize="none"
                                    spellcheck={false}
                                    maxlength="40"
                                    pattern="[a-zA-Z][a-zA-Z0-9\-]{2,39}"
                                    title="Use 3–40 letters, numbers or hyphens, starting with a letter."
                                    placeholder="Automatic"
                                    value={slug() ?? current().handle ?? ""}
                                    onInvalid={(event) => {
                                        const field = event.currentTarget;
                                        field.setCustomValidity(
                                            "Use 3–40 letters, numbers or hyphens, starting with a letter.",
                                        );
                                    }}
                                    onInput={(event) => {
                                        event.currentTarget.setCustomValidity("");
                                        checkSlug(event.currentTarget.value);
                                    }}
                                />
                                <span>
                                    zurich.tech/members/{slug() ?? current().handle ?? "your-name"}
                                </span>
                                <span
                                    aria-live="polite"
                                    classList={{
                                        "form-error":
                                            !!availability.latest.error ||
                                            availability.latest?.isAvailable === false,
                                    }}
                                >
                                    {availability.loading
                                        ? "Checking…"
                                        : availability.latest.error
                                          ? availability.latest.error
                                          : candidate() && availability.latest
                                            ? availability.latest!.isAvailable
                                                ? "Available"
                                                : "Already taken"
                                            : ""}
                                </span>
                            </label>
                            <label class="checkbox">
                                <input
                                    type="checkbox"
                                    name="isPublic"
                                    checked={current().visibility === "public"}
                                />
                                Public profile
                            </label>
                        </div>
                        <ProfileLinkFields
                            profileUrl={current().profileUrl}
                            socials={current().socials}
                        />

                        <FormMessage error={error()} success={success()} />
                    </Editor>
                )}
            </Show>
        </Card>
    );
}
