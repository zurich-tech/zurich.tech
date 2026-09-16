import { registerCommands } from "../search/actions";
import "./mail.css";
import { timestamp } from "../events/time";
import { createResource, createSignal, createUniqueId, Show, For } from "solid-js";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { Card } from "../components/card";
import { Editor, FormMessage, savedEditor, leaveEditor } from "../components/form";
import { useConfirmation } from "../components/dialog";
import { useWorkspaceCommand } from "../app/workspace";

/** Draft and review one-off messages without initiating any deliveries. */
export function Campaigns(props: { eventId?: Id<"events"> }) {
    const formId = createUniqueId();
    const confirm = useConfirmation();
    const [result, { refetch }] = createResource(async () =>
        (await memberClient()).query(api.mail.campaigns.list, {
            eventId: props.eventId,
        }),
    );
    const [selected, setSelected] = createSignal<Id<"campaigns"> | "new">();
    const current = () => result()?.campaigns.find((item) => item._id === selected());
    const [details, { refetch: refreshDetails }] = createResource(
        () => (selected() && selected() !== "new" ? (selected() as Id<"campaigns">) : undefined),
        async (id) => (await memberClient()).query(api.mail.campaigns.preview, { id }),
    );
    const detail = () => {
        if (details.state === "pending" || details.state === "unresolved") return undefined;
        return details.latest?.id === selected() ? details.latest : undefined;
    };
    const [scheduledAt, setScheduledAt] = createSignal<string>();
    const settings = () => result()?.sending;
    const command = useWorkspaceCommand(async () => {
        await refetch();
        await refreshDetails();
    });

    /** Keep edits guarded when switching between saved campaigns. */
    async function select(id?: Id<"campaigns"> | "new") {
        if (await leaveEditor(formId)) {
            setSelected(id);
            setScheduledAt(undefined);
        }
    }

    /** Save a private draft; the separate queue action is always confirmed. */
    async function save(event: SubmitEvent) {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const values = new FormData(form);
        await command.perform(async () => {
            const id = await (
                await memberClient()
            ).mutation(api.mail.campaigns.save, {
                id: selected() === "new" ? undefined : (selected() as Id<"campaigns">),
                audience: props.eventId
                    ? {
                          kind: "registrations",
                          eventId: props.eventId,
                          status: String(values.get("audience") ?? "active") as
                              "active" | "going" | "waitlist" | "attended",
                      }
                    : { kind: "subscribers" },
                subject: String(values.get("subject") ?? ""),
                message: String(values.get("message") ?? ""),
            });
            savedEditor(form);
            setSelected(id);
        }, "Draft saved.");
    }

    /** Confirm the saved version and freshly counted audience before queueing. */
    async function queue() {
        if (!(await leaveEditor(formId))) return;
        await command.perform(async () => {
            // validate scheduling before asking to send
            const sendAt = scheduledAt() === undefined ? undefined : timestamp(scheduledAt()!);
            if (sendAt !== undefined && (!Number.isFinite(sendAt) || sendAt <= Date.now())) {
                throw new Error("Choose a future date and time.");
            }

            // confirm the saved content and current audience
            const client = await memberClient();
            const latest = await client.query(api.mail.campaigns.list, {
                eventId: props.eventId,
            });
            const item = latest.campaigns.find((row) => row._id === selected());
            if (!item) throw new Error("Save the campaign first.");
            const preview = await client.query(api.mail.campaigns.preview, {
                id: item._id,
            });
            if (
                !(await confirm({
                    title: scheduledAt() !== undefined ? "Schedule campaign" : "Send campaign",
                    action: scheduledAt() !== undefined ? "Schedule" : "Send",
                    description: item.subject,
                    emails: preview.recipients,
                    details:
                        scheduledAt() !== undefined
                            ? "Recipients will be counted again at the scheduled time. Unsubscribes are always respected."
                            : `${preview.excluded} excluded by status or preferences. Unsubscribes are checked again before sending.`,
                }))
            )
                return false;
            await client.mutation(api.mail.campaigns.queue, {
                id: item._id,
                expectedUpdatedAt: item.updatedAt,
                expectedRecipients: preview.recipients,
                scheduledAt: sendAt,
            });
        }, "Campaign queued.");
    }

    /** Cancellation stops unsent messages without pretending sent mail can be recalled. */
    function cancel() {
        const item = current();
        if (!item) return;
        void command.perform(async () => {
            if (
                !(await confirm({
                    title: "Cancel campaign",
                    action: "Cancel campaign",
                    description: item.subject,
                    emails: 0,
                    details:
                        "Remaining emails will stop. Emails already being sent cannot be recalled.",
                }))
            )
                return false;
            await (await memberClient()).mutation(api.mail.campaigns.cancel, { id: item._id });
        }, "Campaign cancelled.");
    }

    registerCommands(() =>
        !result.error && result()
            ? [
                  {
                      id: `campaign-new-${formId}`,
                      label: "New campaign",
                      group: "Email",
                      run: () => select("new"),
                  },
                  ...(current()?.status === "draft" &&
                  !command.isPending() &&
                  scheduledAt() !== "" &&
                  settings() &&
                  !settings()!.isLocked &&
                  !settings()!.isPaused &&
                  settings()!.hasWebhook
                      ? [
                            {
                                id: `campaign-send-${formId}`,
                                label:
                                    scheduledAt() === undefined
                                        ? "Send campaign"
                                        : "Schedule campaign",
                                description: "Review content and recipients before sending",
                                group: "Email",
                                run: queue,
                            },
                        ]
                      : []),
              ]
            : [],
    );

    return (
        <Card
            title={
                selected()
                    ? selected() === "new"
                        ? "New campaign"
                        : (current()?.subject ?? "Campaign")
                    : "Campaigns"
            }
            class="mail-panel"
            toolbar={
                <>
                    <Show
                        when={selected()}
                        fallback={
                            <button class="action-link" onClick={() => void select("new")}>
                                New campaign
                            </button>
                        }
                    >
                        <button class="action-link" onClick={() => void select()}>
                            Back
                        </button>
                        <Show
                            when={
                                selected() === "new" ||
                                (current()?.status === "draft" && !current()?.key)
                            }
                        >
                            <button
                                class="button button--primary"
                                type="submit"
                                form={formId}
                                disabled={command.isPending()}
                            >
                                Save
                            </button>
                        </Show>
                    </Show>
                </>
            }
        >
            <FormMessage error={command.error()} success={command.success()} />
            <Show when={result.error}>
                <p class="form-error">Could not load campaigns.</p>
                <button class="button" onClick={() => void refetch()}>
                    Retry
                </button>
            </Show>
            <Show
                when={selected()}
                fallback={
                    <Show
                        when={result()?.campaigns.length}
                        fallback={
                            <Show when={!result.error}>
                                <p class="text-soft">
                                    {result.loading ? "Loading campaigns…" : "No campaigns yet."}
                                </p>
                            </Show>
                        }
                    >
                        <div class="table-scroll">
                            <table class="admin-table mail-campaigns">
                                <thead>
                                    <tr>
                                        <th>Campaign</th>
                                        <th>Status</th>
                                        <th>Recipients</th>
                                        <th>Delivery</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={result()?.campaigns}>
                                        {(item) => (
                                            <tr>
                                                <td>
                                                    <button
                                                        class="text-link"
                                                        onClick={() => void select(item._id)}
                                                    >
                                                        {item.subject}
                                                    </button>
                                                </td>
                                                <td>
                                                    <span
                                                        class="tag tag-status"
                                                        classList={{
                                                            "tag-upcoming":
                                                                item.status === "queued" ||
                                                                item.status === "scheduled",
                                                        }}
                                                    >
                                                        {item.state}
                                                    </span>
                                                </td>
                                                <td>
                                                    {item.audience?.kind === "subscribers"
                                                        ? "Subscribers"
                                                        : item.audience?.kind === "registrations"
                                                          ? {
                                                                active: "Active registrations",
                                                                going: "Confirmed",
                                                                waitlist: "Waitlist",
                                                                attended: "Checked in",
                                                            }[item.audience.status]
                                                          : "—"}
                                                </td>
                                                <td>
                                                    {item.status === "draft"
                                                        ? "Not sent"
                                                        : item.status === "scheduled"
                                                          ? "Scheduled"
                                                          : `${item.accepted.toLocaleString("en-CH")} / ${item.recipients.toLocaleString("en-CH")} accepted`}
                                                    <Show when={item.failed}>
                                                        <span class="mail-failure">
                                                            {item.failed} failed
                                                        </span>
                                                    </Show>
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                    </Show>
                }
            >
                <Show
                    when={
                        selected() === "new" || (current()?.status === "draft" && !current()?.key)
                    }
                    fallback={
                        <p>
                            {current()?.recipients} recipients · {current()?.accepted} accepted ·{" "}
                            {current()?.delivered} delivered · {current()?.failed} failed ·{" "}
                            {current()?.skipped} skipped
                        </p>
                    }
                >
                    <Editor
                        id={formId}
                        class="editor"
                        onSubmit={save}
                        actions={() => (
                            <div class="form-actions">
                                <button
                                    class="button button--primary"
                                    type="submit"
                                    disabled={command.isPending()}
                                >
                                    Save
                                </button>
                            </div>
                        )}
                    >
                        <Show when={props.eventId}>
                            <label>
                                Recipients
                                <select
                                    name="audience"
                                    value={
                                        current()?.audience?.kind === "registrations"
                                            ? (current()!.audience as { status: string }).status
                                            : "active"
                                    }
                                >
                                    <option value="active">All active registrations</option>
                                    <option value="going">Confirmed registrations</option>
                                    <option value="waitlist">Waitlist</option>
                                    <option value="attended">Checked in</option>
                                </select>
                            </label>
                        </Show>
                        <label>
                            Subject
                            <input
                                name="subject"
                                required
                                maxLength={160}
                                value={current()?.subject ?? ""}
                            />
                        </label>
                        <label>
                            Message
                            <textarea
                                name="message"
                                required
                                maxLength={10000}
                                rows={8}
                                value={current()?.message ?? ""}
                            />
                        </label>
                    </Editor>
                </Show>
                <Show when={current()}>
                    {(item) => (
                        <>
                            <Show when={item().pauseReason}>
                                <p class="form-error">{item().pauseReason}</p>
                            </Show>
                            <section class="mail-section">
                                <div class="mail-section-heading">
                                    <h3>Preview</h3>
                                    <span>
                                        {detail() ? "Saved version · " : "Loading preview…"}{" "}
                                        {item().status === "draft"
                                            ? detail()?.recipients
                                            : item().recipients}{" "}
                                        {detail() ? "recipients" : ""}
                                    </span>
                                </div>
                                <iframe
                                    class="email-preview"
                                    title="Campaign preview"
                                    srcdoc={detail()?.html}
                                    sandbox=""
                                />
                            </section>
                            <section class="mail-section">
                                <h3>Delivery</h3>
                                <Show when={settings()?.isLocked}>
                                    <p class="mail-note mail-warning">
                                        Test mode: only your test email can be sent.
                                    </p>
                                </Show>
                                <Show when={item().status === "draft"}>
                                    <div class="mail-timing">
                                        <div
                                            class="mail-buttons"
                                            role="group"
                                            aria-label="Delivery timing"
                                        >
                                            <button
                                                type="button"
                                                class="button"
                                                classList={{
                                                    "button--primary": scheduledAt() === undefined,
                                                }}
                                                aria-pressed={scheduledAt() === undefined}
                                                onClick={() => setScheduledAt(undefined)}
                                            >
                                                Now
                                            </button>
                                            <button
                                                type="button"
                                                class="button"
                                                classList={{
                                                    "button--primary": scheduledAt() !== undefined,
                                                }}
                                                aria-pressed={scheduledAt() !== undefined}
                                                onClick={() => setScheduledAt(scheduledAt() ?? "")}
                                            >
                                                Later
                                            </button>
                                        </div>
                                        <Show when={scheduledAt() !== undefined}>
                                            <label class="field mail-send-at">
                                                <span class="field__label">
                                                    Date and time{" "}
                                                    <span class="mail-note">· Zurich time</span>
                                                </span>
                                                <input
                                                    class="field__control"
                                                    type="datetime-local"
                                                    value={scheduledAt() ?? ""}
                                                    onInput={(event) =>
                                                        setScheduledAt(event.currentTarget.value)
                                                    }
                                                />
                                            </label>
                                        </Show>
                                    </div>
                                </Show>
                                <div class="form-actions">
                                    <button
                                        class="button"
                                        disabled={command.isPending()}
                                        onClick={() =>
                                            void command.perform(async () => {
                                                if (
                                                    !(await confirm({
                                                        title: "Send test",
                                                        action: "Send",
                                                        emails: 1,
                                                        recipients: 1,
                                                        audience: "your verified email",
                                                        description:
                                                            "Send this saved preview to your verified email.",
                                                    }))
                                                )
                                                    return false;
                                                await (
                                                    await memberClient()
                                                ).mutation(api.mail.campaigns.test, {
                                                    id: item()._id,
                                                });
                                            }, "Test queued.")
                                        }
                                    >
                                        Send test to me
                                    </button>
                                    <Show when={!item().key}>
                                        <button
                                            class="button"
                                            disabled={command.isPending()}
                                            onClick={() =>
                                                void command.perform(async () => {
                                                    if (!(await leaveEditor(formId))) return false;
                                                    const id = await (
                                                        await memberClient()
                                                    ).mutation(api.mail.campaigns.duplicate, {
                                                        id: item()._id,
                                                    });
                                                    setSelected(id);
                                                }, "Draft copied.")
                                            }
                                        >
                                            Duplicate
                                        </button>
                                    </Show>
                                    <Show
                                        when={["queued", "scheduled", "paused"].includes(
                                            item().status,
                                        )}
                                    >
                                        <button
                                            class="button"
                                            disabled={command.isPending()}
                                            onClick={() =>
                                                void command.perform(async () => {
                                                    const isPaused = item().status !== "paused";
                                                    if (
                                                        !(await confirm({
                                                            title: isPaused
                                                                ? "Pause campaign"
                                                                : "Resume campaign",
                                                            description: item().subject,
                                                            action: isPaused ? "Pause" : "Resume",
                                                            emails: isPaused
                                                                ? 0
                                                                : Math.max(
                                                                      0,
                                                                      item().recipients -
                                                                          (item().finished ?? 0),
                                                                  ),
                                                            details:
                                                                "Emails already being sent cannot be recalled.",
                                                        }))
                                                    )
                                                        return false;
                                                    await (
                                                        await memberClient()
                                                    ).mutation(api.mail.campaigns.pause, {
                                                        id: item()._id,
                                                        isPaused,
                                                    });
                                                }, "Campaign updated.")
                                            }
                                        >
                                            {item().status === "paused" ? "Resume" : "Pause"}
                                        </button>
                                    </Show>
                                    <Show when={item().status === "draft"}>
                                        <button
                                            class="button button--primary"
                                            disabled={
                                                command.isPending() ||
                                                scheduledAt() === "" ||
                                                !settings() ||
                                                settings()!.isLocked ||
                                                settings()!.isPaused ||
                                                !settings()!.hasWebhook
                                            }
                                            onClick={() => void queue()}
                                        >
                                            {scheduledAt() !== undefined ? "Schedule" : "Send"}
                                        </button>
                                    </Show>
                                    <Show
                                        when={["draft", "queued", "scheduled", "paused"].includes(
                                            item().status,
                                        )}
                                    >
                                        <button
                                            class="button"
                                            disabled={command.isPending()}
                                            onClick={cancel}
                                        >
                                            Cancel campaign
                                        </button>
                                    </Show>
                                    <button
                                        class="button"
                                        onClick={() =>
                                            void command.perform(
                                                async () => await leaveEditor(formId),
                                                "Status refreshed.",
                                            )
                                        }
                                    >
                                        Refresh
                                    </button>
                                </div>
                            </section>
                            <Show when={detail()?.messages.length}>
                                <h3>Recent messages</h3>
                                <div class="table-scroll">
                                    <table class="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Recipient</th>
                                                <th>Status</th>
                                                <th>Attempts</th>
                                                <th>Result</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <For each={detail()?.messages}>
                                                {(message) => (
                                                    <tr>
                                                        <td>{message.to}</td>
                                                        <td>
                                                            {message.isTest ? "Test · " : ""}
                                                            {message.status}
                                                        </td>
                                                        <td>{message.attempts}</td>
                                                        <td>
                                                            {message.outcome ??
                                                                message.error ??
                                                                "—"}
                                                        </td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                            </Show>
                        </>
                    )}
                </Show>
            </Show>
        </Card>
    );
}
