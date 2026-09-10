import { createResource, createSignal, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../core/convex";
import { errorMessage } from "../core/error";
import { Card } from "./card";
import { FormMessage } from "./form";
import { ProfileLinkFields } from "./social";

/** Edit account links independently of purchasing a tier. */
export function ProfileSettings() {
    const [profile, { refetch }] = createResource(async () =>
        (await memberClient()).query(api.profiles.current, {}),
    );
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    /** Validate and save the signed-in member's destinations. */
    async function save(event: SubmitEvent) {
        event.preventDefault();
        const fields = new FormData(event.currentTarget as HTMLFormElement);
        const text = (key: string) => String(fields.get(key) ?? "").trim() || undefined;
        setIsPending(true);
        setError(undefined);
        setSuccess(undefined);
        try {
            await (
                await memberClient()
            ).mutation(api.profiles.save, {
                profileUrl: text("profileUrl"),
                socials: { linkedin: text("linkedin"), github: text("github"), x: text("x") },
            });
            await refetch();
            setSuccess("Profile links saved.");
        } catch (caught) {
            setError(errorMessage(caught, "Could not save profile links."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Card title="Profile links">
            <Show when={profile.error}>
                <p class="form-error">
                    {errorMessage(profile.error, "Could not load profile links.")}
                </p>
            </Show>
            <Show when={profile()}>
                {(current) => (
                    <form class="editor" onSubmit={save}>
                        <p>
                            These links appear with your Patron badge when you enable public
                            recognition.
                        </p>
                        <ProfileLinkFields
                            profileUrl={current().profileUrl}
                            socials={current().socials}
                        />
                        <button class="button button--primary" disabled={isPending()}>
                            {isPending() ? "Saving…" : "Save links"}
                        </button>
                        <FormMessage error={error()} success={success()} />
                    </form>
                )}
            </Show>
        </Card>
    );
}
