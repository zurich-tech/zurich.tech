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

    /** Review today's absolute release limit without resuming paused delivery. */
    async function approve(event: SubmitEvent) {
        // read the requested absolute allowance and sending pace
        event.preventDefault();
        const fields = new FormData(event.currentTarget as HTMLFormElement);
        const limit = Number(fields.get("limit"));
        const ceiling = Number(fields.get("ceiling"));

        // require explicit confirmation because an active sender can consume the released quota
        await command.perform(async () => {
            if (
                !(await confirm({
                    title: "Approve today's delivery",
                    action: "Approve",
                    description: `Release up to ${limit} total attempts today, paced at ${ceiling} per day.`,
                    details:
                        "Includes attempts already used and retries. Expires at Zurich midnight. Paused delivery stays paused; active delivery can continue immediately.",
                }))
            )
                return false;
            await (await memberClient()).mutation(api.mail.sending.approve, { limit, ceiling });
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
                        : `Enable queued subscriber emails with ${latest.remaining} attempts remaining today, paced at ${limit.hourly} per hour.`,
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
                            {value().isPaused
                                ? "Paused"
                                : value().remaining === 0
                                  ? "Awaiting approval"
                                  : "Sending"}
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
                            {/* daily approval */}
                            <form class="editor" onSubmit={approve}>
                                <div class="form-columns">
                                    <label>
                                        Daily pace
                                        <input
                                            name="ceiling"
                                            type="number"
                                            min="1"
                                            max="10000"
                                            step="1"
                                            required
                                            value={value().limits.daily}
                                        />
                                    </label>
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
                                </div>
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
                                                : value().remaining === 0
                                                  ? "Queued campaigns await today's approval."
                                                  : "Queued campaigns are being sent."))}
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
