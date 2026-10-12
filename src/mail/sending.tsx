import { createResource, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { Card } from "../components/card";
import { FormMessage } from "../components/form";
import { useConfirmation } from "../components/dialog";
import { useWorkspaceCommand } from "../app/workspace";

/** Keep sender readiness, pace and delivery controls in distinct labelled sections. */
export function Sending() {
    const confirm = useConfirmation();
    const [settings, { refetch }] = createResource(async () =>
        (await memberClient()).query(api.mail.sending.current, {}),
    );
    const command = useWorkspaceCommand(refetch);

    /** Set shared limits independently of campaign approval. */
    async function pace(event: SubmitEvent) {
        event.preventDefault();
        const fields = new FormData(event.currentTarget as HTMLFormElement);
        const daily = Number(fields.get("daily"));
        const hourly = Number(fields.get("hourly"));

        await command.perform(async () => {
            if (
                !(await confirm({
                    title: "Update sending limits",
                    action: "Save",
                    description: `Allow up to ${daily} bulk attempts per day, paced at ${hourly} per hour.`,
                    details:
                        "Applies to newsletters and approved campaigns. Existing usage and delivery protections are preserved; no campaigns are approved or resumed.",
                }))
            )
                return false;
            await (await memberClient()).mutation(api.mail.sending.pace, { daily, hourly });
        }, "Sending limits saved.");
    }

    /** Review today's absolute release limit without resuming paused delivery. */
    async function approve(event: SubmitEvent) {
        // read the requested absolute allowance
        event.preventDefault();
        const fields = new FormData(event.currentTarget as HTMLFormElement);
        const limit = Number(fields.get("limit"));

        // require explicit confirmation because an active sender can consume the released quota
        await command.perform(async () => {
            const client = await memberClient();
            const latest = await client.query(api.mail.sending.current, {});
            if (
                !(await confirm({
                    title: "Approve today's delivery",
                    action: "Approve",
                    description: `Release campaigns up to ${limit} total bulk attempts today, paced at ${latest.limits.hourly} per hour.`,
                    details:
                        "Includes attempts already used and retries. Expires at Zurich midnight. Paused delivery stays paused; active delivery can continue immediately.",
                }))
            )
                return false;
            await client.mutation(api.mail.sending.approve, { limit });
        }, "Today's limit approved.");
    }

    /** Confirm delivery changes; ordinary saves never enable sending. */
    async function change(isPaused: boolean) {
        await command.perform(async () => {
            const client = await memberClient();
            const latest = await client.query(api.mail.sending.current, {});
            const limit = latest.limits;
            if (
                isPaused !== latest.isPaused &&
                !(await confirm({
                    title: isPaused ? "Pause delivery" : "Resume delivery",
                    action: isPaused ? "Pause" : "Resume",
                    description: isPaused
                        ? "Stop sending queued subscriber emails."
                        : `Enable scheduled newsletters and approved campaigns, paced at ${limit.hourly} per hour with a shared daily limit of ${limit.daily}.`,
                    details:
                        "Registration confirmations and event notices are handled separately. Emails already being sent cannot be recalled.",
                }))
            )
                return false;
            await client.mutation(api.mail.sending.configure, { isPaused });
        }, "Settings saved.");
    }

    return (
        <Card
            title="Delivery settings"
            class="mail-panel"
            toolbar={
                <Show when={settings()}>
                    {(value) => (
                        <span class="tag status-control">
                            {value().isPaused ? "Paused" : "Enabled"}
                        </span>
                    )}
                </Show>
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
                                        class="tag tag-status"
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
                            <h3>Sending pace</h3>
                            <dl class="statistics">
                                <div>
                                    <dt>Per day</dt>
                                    <dd>{value().limits.daily.toLocaleString("en-CH")}</dd>
                                </div>
                                <div>
                                    <dt>Per hour</dt>
                                    <dd>{value().limits.hourly.toLocaleString("en-CH")}</dd>
                                </div>
                                <div>
                                    <dt>Used today</dt>
                                    <dd>{value().count.toLocaleString("en-CH")}</dd>
                                </div>
                            </dl>
                            {/* shared limits */}
                            <form class="editor" onSubmit={pace}>
                                <div class="form-columns">
                                    <label>
                                        Daily limit
                                        <input
                                            name="daily"
                                            type="number"
                                            min="1"
                                            max="10000"
                                            step="1"
                                            required
                                            value={value().limits.daily}
                                        />
                                    </label>
                                    <label>
                                        Hourly limit
                                        <input
                                            name="hourly"
                                            type="number"
                                            min="1"
                                            max="3600"
                                            step="1"
                                            required
                                            value={value().limits.hourly}
                                        />
                                    </label>
                                </div>
                                <button class="button" type="submit" disabled={command.isPending()}>
                                    Save sending limits
                                </button>
                            </form>
                        </section>
                        <section class="mail-section">
                            <h3>Campaign approval</h3>
                            <p class="mail-note">
                                Scheduled newsletter editions send automatically within the shared
                                limits. Other bulk campaigns require approval for each sending day.
                            </p>
                            <form class="editor" onSubmit={approve}>
                                <label>
                                    Approved total today
                                    <input
                                        name="limit"
                                        type="number"
                                        min={value().count}
                                        max="10000"
                                        step="1"
                                        required
                                        value={Math.max(value().approvedLimit, value().count)}
                                    />
                                </label>
                                <button class="button" type="submit" disabled={command.isPending()}>
                                    Approve today's limit
                                </button>
                            </form>
                            <p class="mail-note">
                                {value().remaining > 0
                                    ? `${value().remaining} attempts remaining today.`
                                    : "Awaiting approval."}{" "}
                                Approvals expire at Zurich midnight. Retries count toward the limit.
                            </p>
                        </section>
                        <Show when={value().accepted || value().bounced || value().complained}>
                            <section class="mail-section">
                                <h3>Since last resume</h3>
                                <dl class="statistics">
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
                        <section class="mail-section">
                            <h3>Complaint rate</h3>
                            <p class="mail-note">
                                {value().health.complained} complaints /{" "}
                                {value().health.sent.toLocaleString("en-CH")} sends
                                {" · "}
                                {value().health.rate.toFixed(3)}% · Last 7 Zurich calendar days.
                            </p>
                            <Show when={value().health.complained > 0}>
                                <p role="status">
                                    Complaining addresses have been suppressed. Bulk delivery pauses
                                    at 0.08%.
                                </p>
                            </Show>
                        </section>
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
                                                : "Scheduled newsletters and approved campaigns can send within the shared limits."))}
                                </p>
                            </div>
                            <div class="mail-buttons">
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
