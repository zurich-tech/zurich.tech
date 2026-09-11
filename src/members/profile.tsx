import { createResource, createSignal, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { errorMessage } from "../components/errors";
import { Card } from "../components/card";
import { FormMessage } from "../components/form";
import { ProfileLinkFields } from "../components/social";

/** Edit account links independently of purchasing a tier. */
export function ProfileSettings() {
    const [profile, { refetch }] = createResource(async () =>
        (await memberClient()).query(api.members.profiles.current, {}),
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
            ).mutation(api.members.profiles.save, {
                headline: text("headline"),
                profileUrl: text("profileUrl"),
                socials: { linkedin: text("linkedin"), github: text("github"), x: text("x") },
            });
            await refetch();
            setSuccess("Profile saved.");
        } catch (caught) {
            setError(errorMessage(caught, "Could not save profile."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Card title="Profile">
            <Show when={profile.error}>
                <p class="form-error">{errorMessage(profile.error, "Could not load profile.")}</p>
            </Show>
            <Show when={profile()}>
                {(current) => (
                    <form class="editor" onSubmit={save}>
                        <p>
                            These links appear with your Patron badge when you enable public
                            recognition.
                        </p>
                        <label>
                            Headline
                            <input
                                name="headline"
                                maxlength="160"
                                placeholder="Student, Founder @ Company…"
                                value={current().headline ?? ""}
                            />
                        </label>
                        <ProfileLinkFields
                            profileUrl={current().profileUrl}
                            socials={current().socials}
                        />
                        <button class="button button--primary" disabled={isPending()}>
                            {isPending() ? "Saving…" : "Save profile"}
                        </button>
                        <FormMessage error={error()} success={success()} />
                    </form>
                )}
            </Show>
        </Card>
    );
}
