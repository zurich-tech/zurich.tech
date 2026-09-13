import { useUnsavedChanges } from "../components/unsaved";
import { createResource, createSignal, Show, For } from "solid-js";
import { ceilings } from "../../convex/mail/policy";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { Card } from "../components/card";
import { FormMessage } from "../components/form";
import { useConfirmation } from "../components/dialog";
import { useWorkspaceCommand } from "../app/workspace";

const names = { new: "Gradual", established: "Established", complete: "Standard" };

/** Keep sender readiness, pace and delivery controls in distinct labelled sections. */
export function Sending() {
    const confirm = useConfirmation();
    const [settings, { refetch }] = createResource(async () =>
        (await memberClient()).query(api.mail.sending.current, {}),
    );
    const [profile, setProfile] = createSignal<keyof typeof names>();
    const command = useWorkspaceCommand(refetch);
    const limits = () => ceilings(profile() ?? settings()!.profile, settings()!.day);
    const isChanged = () => !!profile() && profile() !== settings()?.profile;
    useUnsavedChanges(isChanged);

    /** Confirm delivery changes; ordinary saves never enable sending. */
    async function change(isPaused: boolean) {
        await command.perform(async () => {
            const client = await memberClient();
            const latest = await client.query(api.mail.sending.current, {});
            const selected = profile() ?? latest.profile;
            const limit = ceilings(selected, latest.day);
            if (
                isPaused !== latest.isPaused &&
                !(await confirm({
                    title: isPaused ? "Pause delivery" : "Resume delivery",
                    action: isPaused ? "Pause" : "Resume",
                    description: isPaused
                        ? "Stop sending queued subscriber emails."
                        : `Send queued subscriber emails at up to ${limit.daily} per day and ${limit.hourly} per hour.`,
                    details:
                        "Registration confirmations and event notices are handled separately. Emails already being sent cannot be recalled.",
                }))
            )
                return false;
            await client.mutation(api.mail.sending.configure, { isPaused, profile: selected });
            setProfile(undefined);
        }, "Settings saved.");
    }

    return (
        <Card
            title="Delivery settings"
            class="mail-panel"
            toolbar={
                <>
                    <Show when={settings()}>
                        {(value) => (
                            <>
                                <span class="tag status-control">
                                    {value().isPaused ? "Paused" : "Sending"}
                                </span>
                                <button
                                    class="button button--primary"
                                    disabled={command.isPending() || !isChanged()}
                                    onClick={() => void change(value().isPaused)}
                                >
                                    Save
                                </button>
                            </>
                        )}
                    </Show>
                </>
            }
        >
            <FormMessage
                error={
                    command.error() ||
                    (settings.error ? "Could not load delivery settings." : undefined)
                }
                success={command.success()}
            />
            <Show when={settings()}>
                {(value) => (
                    <>
                        <dl class="mail-settings">
                            <div>
                                <dt>Sender</dt>
                                <dd>{value().sender}</dd>
                            </div>
                            <div>
                                <dt>Delivery reports</dt>
                                <dd>
                                    <span
                                        class="tag"
                                        classList={{ "tag-upcoming": value().hasWebhook }}
                                    >
                                        {value().hasWebhook ? "Connected" : "Not connected"}
                                    </span>
                                </dd>
                            </div>
                            <div>
                                <dt>Recipients</dt>
                                <dd>
                                    {value().isLocked
                                        ? "Approved test addresses only"
                                        : "Eligible subscribers and registrants"}
                                </dd>
                            </div>
                        </dl>
                        <section class="mail-section">
                            <div class="mail-section-heading">
                                <h3>Sending pace</h3>
                                <span>Day {value().day + 1}</span>
                            </div>
                            <div class="mail-pace">
                                <label class="field">
                                    Profile
                                    <select
                                        class="field__control"
                                        value={profile() ?? value().profile}
                                        disabled={!value().isPaused || command.isPending()}
                                        onChange={(event) =>
                                            setProfile(
                                                event.currentTarget.value as keyof typeof names,
                                            )
                                        }
                                    >
                                        <For each={Object.entries(names)}>
                                            {([key, name]) => <option value={key}>{name}</option>}
                                        </For>
                                    </select>
                                </label>
                                <dl class="mail-facts">
                                    <div>
                                        <dt>Per day</dt>
                                        <dd>{limits().daily.toLocaleString("en-CH")}</dd>
                                    </div>
                                    <div>
                                        <dt>Per hour</dt>
                                        <dd>{limits().hourly.toLocaleString("en-CH")}</dd>
                                    </div>
                                    <div>
                                        <dt>Used today</dt>
                                        <dd>{value().count.toLocaleString("en-CH")}</dd>
                                    </div>
                                </dl>
                            </div>
                            <p class="mail-note">
                                {(profile() ?? value().profile) === "complete"
                                    ? "Fixed limits for regular sending."
                                    : "Limits increase on days we send email."}
                            </p>
                        </section>
                        <Show when={value().accepted || value().bounced || value().complained}>
                            <section class="mail-section">
                                <h3>Since last resume</h3>
                                <dl class="mail-facts">
                                    <div>
                                        <dt>Accepted</dt>
                                        <dd>{value().accepted}</dd>
                                    </div>
                                    <div>
                                        <dt>Bounced</dt>
                                        <dd>{value().bounced}</dd>
                                    </div>
                                    <div>
                                        <dt>Complaints</dt>
                                        <dd>{value().complained}</dd>
                                    </div>
                                </dl>
                            </section>
                        </Show>
                        <div class="mail-control">
                            <div>
                                <strong>Subscriber delivery</strong>
                                <p>
                                    {value().isLocked
                                        ? "Test mode must be turned off before sending to subscribers."
                                        : !value().hasWebhook
                                          ? "Connect delivery reports before enabling subscriber emails."
                                          : (value().pauseReason ??
                                            (value().isPaused
                                                ? "Queued campaigns are held."
                                                : "Queued campaigns are being sent."))}
                                </p>
                            </div>
                            <div class="mail-buttons">
                                <Show when={isChanged()}>
                                    <button
                                        class="button button--primary"
                                        disabled={command.isPending()}
                                        onClick={() => void change(value().isPaused)}
                                    >
                                        Save
                                    </button>
                                </Show>
                                <button
                                    class="button"
                                    disabled={
                                        command.isPending() ||
                                        (value().isPaused &&
                                            (value().isLocked || !value().hasWebhook))
                                    }
                                    onClick={() => void change(!value().isPaused)}
                                >
                                    {value().isPaused ? "Resume" : "Pause"}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </Show>
        </Card>
    );
}
