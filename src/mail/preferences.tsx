import { createEffect, createSignal, For, Show } from "solid-js";
import type { Preferences, Scope } from "../../convex/mail/consent";
import { Editor, savedEditor, FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";
import { site } from "../app/site";
import "./preferences.css";

/** Labels shared by settings and private email links. */
export const emailGroups = [
    {
        title: "Community",
        choices: [
            {
                key: "weekly",
                scope: "weekly",
                label: "Newsletter",
                description: "Events, news and jobs every Monday.",
            },
            {
                key: "announcements",
                scope: "announcement",
                label: "New events",
                description: "Announcements and occasional invitations.",
            },
        ],
    },
    {
        title: "Your registrations",
        choices: [
            {
                key: "reminders",
                scope: "reminder",
                label: "Event reminders",
                description: "A reminder before events you register for.",
            },
            {
                key: "followUps",
                scope: "followup",
                label: "Event follow-ups",
                description: "Resources, thank-you emails and feedback.",
            },
        ],
    },
] as const;

/** Describe the category requested by a private unsubscribe link. */
export function emailChoice(scope: Scope) {
    return emailGroups
        .flatMap((group) => [...group.choices])
        .find((choice) => choice.scope === scope);
}

/** Edit optional emails with explicit saves and consistent feedback. */
export function EmailPreferences(props: {
    value: Preferences;
    isSuppressed: boolean;
    onSave: (value: Preferences) => Promise<void>;
}) {
    let form!: HTMLFormElement;
    const choices = (): Preferences => {
        const { weekly, announcements, reminders, followUps } = props.value;

        return { weekly, announcements, reminders, followUps };
    };
    const [value, setValue] = createSignal(choices());
    const [isPending, setIsPending] = createSignal(false);
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();
    createEffect(() => setValue(choices()));
    const isChanged = () =>
        emailGroups.some((group) =>
            group.choices.some((choice) => value()[choice.key] !== props.value[choice.key]),
        );

    /** Retain edits after a failed save. */
    async function save(choices: Preferences) {
        setIsPending(true);
        setError(undefined);
        setSuccess(undefined);
        try {
            await props.onSave(choices);
            savedEditor(form);
            setSuccess("Saved.");
        } catch (caught) {
            setError(errorMessage(caught, "Could not save your preferences. Please try again."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Editor class="mail-preferences" ref={form} onSubmit={() => save(value())}>
            <Show when={props.isSuppressed}>
                <p class="form-error">
                    Email delivery is blocked for this address.{" "}
                    <a href={`mailto:${site.email}`}>Contact the team</a> to resolve it.
                </p>
            </Show>
            <For each={emailGroups}>
                {(group) => (
                    <fieldset disabled={isPending() || props.isSuppressed}>
                        <legend>{group.title}</legend>
                        <For each={group.choices}>
                            {(choice) => (
                                <label class="mail-preferences__row">
                                    <span>
                                        <strong>{choice.label}</strong>
                                        <small>{choice.description}</small>
                                    </span>
                                    <input
                                        type="checkbox"
                                        name={choice.key}
                                        role="switch"
                                        aria-label={choice.label}
                                        checked={value()[choice.key]}
                                        onChange={(event) => {
                                            setValue({
                                                ...value(),
                                                [choice.key]: event.currentTarget.checked,
                                            });
                                            setSuccess(undefined);
                                        }}
                                    />
                                </label>
                            )}
                        </For>
                    </fieldset>
                )}
            </For>
            <Show when={!props.isSuppressed}>
                <div class="mail-preferences__actions">
                    <button
                        type="submit"
                        class="button button--primary"
                        disabled={isPending() || props.isSuppressed || !isChanged()}
                    >
                        {isPending() ? "Saving…" : "Save preferences"}
                    </button>
                    <Show when={success()}>
                        <span role="status">{success()}</span>
                    </Show>
                </div>
                <FormMessage error={error()} />
                <button
                    type="button"
                    class="text-link"
                    disabled={
                        isPending() ||
                        props.isSuppressed ||
                        !emailGroups.some((group) =>
                            group.choices.some((choice) => props.value[choice.key]),
                        )
                    }
                    onClick={() =>
                        void save({
                            weekly: false,
                            announcements: false,
                            reminders: false,
                            followUps: false,
                        })
                    }
                >
                    Unsubscribe from all optional emails
                </button>
            </Show>
            <p class="mail-preferences__note">
                {props.isSuppressed
                    ? "Your saved preferences are shown above. No emails will be sent while delivery is blocked."
                    : "Registration confirmations, cancellations and important changes to your bookings will still reach you."}
            </p>
        </Editor>
    );
}
