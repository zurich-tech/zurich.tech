import { Show, createResource, createSignal } from "solid-js";
import { Card } from "../components/card";
import { useConfirmation } from "../components/dialog";
import { FormMessage } from "../components/form";
import { useWorkspaceCommand } from "../app/workspace";
import { memberClient } from "../auth/convex";
import { api } from "../../convex/_generated/api";
import type { ProfilePrompt } from "../../convex/mail/involvement";
import { FilterSelect } from "../components/filter-select";

/** Show the next edition and its automatic schedule. */
export function NewsletterSchedule() {
    const confirm = useConfirmation();
    const [profile, setProfile] = createSignal<ProfilePrompt>("create");
    const [edition, { refetch }] = createResource(profile, async (profile) =>
        (await memberClient()).query(api.mail.newsletter.preview, { profile }),
    );
    const [sending] = createResource(async () =>
        (await memberClient()).query(api.mail.sending.current, {}),
    );
    const command = useWorkspaceCommand(refetch);

    /** Confirm the schedule change independently of existing campaigns. */
    async function change() {
        await command.perform(async () => {
            const client = await memberClient();
            const latest = await client.query(api.mail.newsletter.preview, {});
            const isPaused = !latest.isPaused;
            if (
                !(await confirm({
                    title: isPaused ? "Pause newsletter" : "Resume newsletter",
                    action: isPaused ? "Pause" : "Resume",
                    description: isPaused
                        ? "Stop automatic weekly editions."
                        : "Send every Monday at 08:00 Zurich time when events, news or jobs are available.",
                    emails: 0,
                    details: isPaused
                        ? "Already queued campaigns are unaffected."
                        : `${latest.subscribers.toLocaleString("en-CH")} subscribers are currently eligible. Nothing sends immediately.`,
                }))
            )
                return false;
            await client.mutation(api.mail.newsletter.pause, { isPaused });
        }, "Schedule updated.");
    }

    return (
        <Card
            title="Newsletter"
            class="mail-panel"
            toolbar={
                <>
                    <span class="tag status-control">
                        {edition()?.isPaused ? "Paused" : "Scheduled"}
                    </span>
                    <button
                        class="button"
                        disabled={
                            command.isPending() ||
                            !edition() ||
                            (!!edition()?.isPaused &&
                                (sending()?.isLocked || !sending()?.hasWebhook))
                        }
                        onClick={() => void change()}
                    >
                        {edition()?.isPaused ? "Resume" : "Pause"}
                    </button>
                </>
            }
        >
            <FormMessage
                error={
                    command.error() ||
                    (edition.error ? "Could not load the newsletter." : undefined)
                }
                success={command.success()}
            />
            <Show when={edition()}>
                {(value) => (
                    <>
                        <dl class="statistics">
                            <div>
                                <dt>Schedule</dt>
                                <dd>Monday, 08:00</dd>
                                <span>Zurich time</span>
                            </div>
                            <div>
                                <dt>Recipients</dt>
                                <dd>{value().subscribers.toLocaleString("en-CH")}</dd>
                                <span>Subscribers</span>
                            </div>
                            <div>
                                <dt>Next edition</dt>
                                <dd>
                                    {value().events.length}{" "}
                                    {value().events.length === 1 ? "event" : "events"} ·{" "}
                                    {value().news} {value().news === 1 ? "story" : "stories"} ·{" "}
                                    {value().jobs} {value().jobs === 1 ? "job" : "jobs"}
                                </dd>
                                <span>Empty weeks are skipped</span>
                            </div>
                        </dl>
                        <Show when={sending()}>
                            {(delivery) => (
                                <p class="mail-note">
                                    {delivery().isPaused
                                        ? "Subscriber delivery is paused. Scheduled editions will not send until delivery resumes."
                                        : `Automatic delivery at up to ${delivery().limits.hourly.toLocaleString("en-CH")} emails per hour, within the shared ${delivery().limits.daily.toLocaleString("en-CH")} daily limit.`}
                                </p>
                            )}
                        </Show>
                        <section class="mail-section">
                            <h3>Next edition</h3>
                            <FilterSelect
                                label="Survey invitation"
                                value={profile()}
                                onChange={(value) => setProfile(value as ProfilePrompt)}
                                options={[
                                    { value: "create", label: "No account" },
                                    { value: "complete", label: "Survey incomplete" },
                                    { value: "update", label: "Survey updated" },
                                    { value: "none", label: "Survey current" },
                                ]}
                            />
                            <iframe
                                class="email-preview"
                                title="Newsletter preview"
                                srcdoc={value().html}
                                sandbox=""
                            />
                        </section>
                    </>
                )}
            </Show>
        </Card>
    );
}
