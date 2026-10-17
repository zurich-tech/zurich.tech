import { registerCommands } from "../search/actions";
import { useAccess } from "../auth/edit";
import "./mail.css";
import { civilTime, timestamp } from "../../convex/events/time";
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
    const access = useAccess();
    const canOperate = () =>
        props.eventId ? access.canEvent(props.eventId, "organiser") : !!access.current()?.isAdmin;
    const canSend = () => canOperate() && !!access.current()?.canSendMail;
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
    const [hourlyInput, setHourlyInput] = createSignal<string>();
    const [announcementEvent, setAnnouncementEvent] = createSignal("");
    const [isSeriesOnly, setIsSeriesOnly] = createSignal(true);
    const [isDeliveredOnly, setIsDeliveredOnly] = createSignal(true);
    const [events] = createResource(
        () => !props.eventId,
        async () => (await memberClient()).query(api.mail.campaigns.announcements, {}),
    );
    const settings = () => result()?.sending;
    const hourlyMaximum = () => Math.min(3600, settings()?.limits.hourly ?? 0);
    const hourlyLimit = () =>
        hourlyInput() ??
        String(Math.min(hourlyMaximum(), Math.max(1, Math.ceil((detail()?.recipients ?? 0) / 4))));
    const isHourlyValid = () => {
        const limit = Number(hourlyLimit());

        return Number.isInteger(limit) && limit >= 1 && limit <= hourlyMaximum();
    };
    const isOverDailyLimit = () =>
        !!detail() && !!settings() && detail()!.recipients > settings()!.limits.daily;
    const command = useWorkspaceCommand(async () => {
        await refetch();
        await refreshDetails();
    });

    /** Allow subscriber approval only before any recipients or attempts have been admitted. */
    function isQueueable(item: NonNullable<ReturnType<typeof current>>) {
        if (item.status !== "draft") return false;
        if (item.audience?.kind !== "subscribers") return item.attemptLimit === undefined;

        return (
            !!access.current()?.isAdmin &&
            !item.approval &&
            item.recipients === 0 &&
            (item.attempts ?? 0) === 0 &&
            (item.attemptLimit === undefined || item.attemptLimit === 0)
        );
    }

    /** Keep legacy subscriber queues separate from newly approved frozen campaigns. */
    function isLegacy(item: NonNullable<ReturnType<typeof current>>) {
        return (
            item.audience?.kind === "subscribers" &&
            !item.approval &&
            (item.attemptLimit !== undefined || item.recipients > 0 || (item.attempts ?? 0) > 0) &&
            !isQueueable(item)
        );
    }

    /** Keep edits guarded when switching between saved campaigns. */
    async function select(id?: Id<"campaigns"> | "new") {
        if (await leaveEditor(formId)) {
            setSelected(id);
            setScheduledAt(undefined);
            setHourlyInput(undefined);
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
            if (selected() !== id) {
                setScheduledAt(undefined);
                setHourlyInput(undefined);
            }
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
            if (!isQueueable(item)) throw new Error("This campaign cannot receive a new approval.");
            const preview = await client.query(api.mail.campaigns.preview, {
                id: item._id,
            });
            if (preview.updatedAt !== item.updatedAt)
                throw new Error("Campaign changed. Preview it again.");

            // bind subscriber approval to the displayed pace and a freshly counted audience
            const isSubscriber = item.audience?.kind === "subscribers";
            const limit = isSubscriber ? Number(hourlyLimit()) : undefined;
            if (
                limit !== undefined &&
                (!Number.isInteger(limit) ||
                    limit < 1 ||
                    limit > Math.min(3600, latest.sending.limits.hourly))
            )
                throw new Error(
                    `Choose a whole-number hourly limit from 1 to ${Math.min(3600, latest.sending.limits.hourly)}.`,
                );
            if (isSubscriber && preview.recipients === 0)
                throw new Error("There are no eligible subscribers to approve.");
            if (isSubscriber && preview.recipients > latest.sending.limits.daily)
                throw new Error(
                    `The audience of ${preview.recipients} exceeds the shared daily limit of ${latest.sending.limits.daily}.`,
                );
            if (
                isSubscriber &&
                (!preview.recipientIds || preview.recipientIds.length !== preview.recipients)
            )
                throw new Error(
                    "Could not verify the exact subscriber audience. Refresh the preview.",
                );
            const sendingTime = civilTime(sendAt ?? Date.now()).replace("T", " ");
            if (
                !(await confirm({
                    title: sendAt !== undefined ? "Schedule campaign" : "Send campaign",
                    action: isSubscriber
                        ? sendAt !== undefined
                            ? "Approve and schedule"
                            : "Approve and send"
                        : sendAt !== undefined
                          ? "Schedule"
                          : "Send",
                    description: item.subject,
                    emails: preview.recipients,
                    details: isSubscriber
                        ? `${sendingTime} Zurich time · Up to ${limit}/hour. Freeze the saved content and these ${preview.recipients} recipients; approve ${preview.recipients} attempts (including retries), until that day's Zurich midnight. Unsubscribes, exclusions, shared limits and complaint protections still apply.`
                        : sendAt !== undefined
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
                ...(isSubscriber
                    ? { hourlyLimit: limit!, expectedRecipientIds: preview.recipientIds! }
                    : {}),
            });
        }, "Campaign queued.");
    }

    /** Prepare a template draft without consuming quota or creating messages. */
    async function prepareAnnouncement() {
        await command.perform(async () => {
            const event = events()?.find((row) => row.id === announcementEvent());
            if (!event) throw new Error("Choose an event.");
            const id = await (
                await memberClient()
            ).mutation(api.mail.campaigns.announcement, {
                eventId: event.id,
                audience: {
                    kind: "subscribers",
                    excludeEventId: event.id,
                    seriesId: isSeriesOnly() ? event.seriesId : undefined,
                    deliveredSince: isDeliveredOnly() ? Date.now() - 30 * 86400000 : undefined,
                },
            });
            setSelected(id);
            setScheduledAt(undefined);
            setHourlyInput(undefined);
        }, "Announcement draft prepared. Nothing sent.");
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
                  ...(current() &&
                  isQueueable(current()!) &&
                  (current()?.audience?.kind !== "subscribers" ||
                      (isHourlyValid() && !!detail()?.recipients && !isOverDailyLimit())) &&
                  canSend() &&
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
                                (current()?.status === "draft" &&
                                    !current()?.key &&
                                    current()?.attemptLimit === undefined)
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
            <Show when={!selected() && !props.eventId}>
                <section class="mail-section">
                    <h3>Event announcement</h3>
                    <Show when={events.error}>
                        <p class="form-error">Could not load events.</p>
                    </Show>
                    <label class="field">
                        Event
                        <select
                            value={announcementEvent()}
                            onChange={(event) => setAnnouncementEvent(event.currentTarget.value)}
                        >
                            <option value="">Choose an event</option>
                            <For each={events()}>
                                {(event) => <option value={event.id}>{event.title}</option>}
                            </For>
                        </select>
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            checked={isSeriesOnly()}
                            onChange={(event) => setIsSeriesOnly(event.currentTarget.checked)}
                        />{" "}
                        Past series registrants only
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            checked={isDeliveredOnly()}
                            onChange={(event) => setIsDeliveredOnly(event.currentTarget.checked)}
                        />{" "}
                        Delivered in the last 30 days, no adverse history
                    </label>
                    <div class="form-actions">
                        <button
                            class="button"
                            disabled={
                                !announcementEvent() ||
                                command.isPending() ||
                                (isSeriesOnly() &&
                                    !events()?.find((event) => event.id === announcementEvent())
                                        ?.seriesId)
                            }
                            onClick={() => void prepareAnnouncement()}
                        >
                            Prepare preview
                        </button>
                    </div>
                </section>
            </Show>
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
                        selected() === "new" ||
                        (current()?.status === "draft" &&
                            !current()?.key &&
                            current()?.attemptLimit === undefined)
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
                                        {!item().approval && item().status === "draft"
                                            ? detail()?.recipients
                                            : item().recipients}{" "}
                                        {item().approval
                                            ? "approved recipients"
                                            : detail()
                                              ? "recipients"
                                              : ""}
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
                                {/* audience order */}
                                <Show when={!item().approval && detail()?.audience}>
                                    {(audience) => (
                                        <details>
                                            <summary>
                                                Audience preview (up to 100 recipients)
                                            </summary>
                                            <p>
                                                Registrations: last 90 days ({audience().cohorts[0]}
                                                ), last year ({audience().cohorts[1]}), older (
                                                {audience().cohorts[2]}), none (
                                                {audience().cohorts[3]}). Most distinct events first
                                                within each group, then recent activity.
                                            </p>
                                            <ol>
                                                <For each={audience().first}>
                                                    {(row) => (
                                                        <li>
                                                            {row.email} · {row.events} events
                                                            {row.latest
                                                                ? ` · ${new Date(row.latest).toLocaleDateString("en-GB", { timeZone: "Europe/Zurich" })}`
                                                                : ""}
                                                        </li>
                                                    )}
                                                </For>
                                            </ol>
                                        </details>
                                    )}
                                </Show>
                                <Show when={settings()?.isLocked}>
                                    <p class="mail-note mail-warning">
                                        Test mode: only your test email can be sent.
                                    </p>
                                </Show>
                                {/* saved approval is independent of shared daily approval */}
                                <Show when={item().approval}>
                                    {(approval) => (
                                        <>
                                            <dl class="mail-settings">
                                                <div>
                                                    <dt>Send time · Zurich</dt>
                                                    <dd>
                                                        {civilTime(
                                                            item().scheduledAt ??
                                                                approval().approvedAt,
                                                        ).replace("T", " ")}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt>Approved audience · frozen</dt>
                                                    <dd>{item().recipients} recipients</dd>
                                                </div>
                                                <div>
                                                    <dt>Attempt cap · retries included</dt>
                                                    <dd>
                                                        {item().attempts ?? 0} / {approval().limit}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt>Campaign pace</dt>
                                                    <dd>
                                                        {approval().hourlyLimit} attempts per hour
                                                    </dd>
                                                </div>
                                                <Show when={item().nextAttemptAt}>
                                                    {(next) => (
                                                        <div>
                                                            <dt>
                                                                Next attempt no earlier than ·
                                                                Zurich
                                                            </dt>
                                                            <dd>
                                                                {civilTime(next()).replace(
                                                                    "T",
                                                                    " ",
                                                                )}
                                                            </dd>
                                                        </div>
                                                    )}
                                                </Show>
                                            </dl>
                                            <p class="mail-note">
                                                Approval expires at Zurich midnight at the end of{" "}
                                                {approval().date}. Shared limits, exclusions and
                                                complaint guards still apply.
                                            </p>
                                        </>
                                    )}
                                </Show>
                                <Show when={isLegacy(item())}>
                                    <p class="mail-note mail-warning">
                                        Legacy campaign: no further recipients can be released here.{" "}
                                        Create a new draft for a new audience approval.
                                    </p>
                                </Show>
                                <Show when={isQueueable(item())}>
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
                                                disabled={command.isPending()}
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
                                                disabled={command.isPending()}
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
                                                    disabled={command.isPending()}
                                                    value={scheduledAt() ?? ""}
                                                    onInput={(event) =>
                                                        setScheduledAt(event.currentTarget.value)
                                                    }
                                                />
                                            </label>
                                        </Show>
                                        <Show when={item().audience?.kind === "subscribers"}>
                                            <label class="field mail-send-at">
                                                <span class="field__label">Attempts per hour</span>
                                                <input
                                                    class="field__control"
                                                    type="number"
                                                    min="1"
                                                    max={hourlyMaximum()}
                                                    step="1"
                                                    required
                                                    value={hourlyLimit()}
                                                    aria-invalid={!isHourlyValid()}
                                                    aria-describedby={`${formId}-hourly-limit`}
                                                    disabled={command.isPending() || !settings()}
                                                    onInput={(event) =>
                                                        setHourlyInput(event.currentTarget.value)
                                                    }
                                                />
                                            </label>
                                        </Show>
                                    </div>
                                    <Show when={item().audience?.kind === "subscribers"}>
                                        <p class="mail-note" id={`${formId}-hourly-limit`}>
                                            Shared maximum: {hourlyMaximum()} per hour
                                        </p>
                                        <Show when={isOverDailyLimit()}>
                                            <p class="form-error" role="alert">
                                                The audience of {detail()?.recipients} exceeds the
                                                shared daily limit of {settings()?.limits.daily}.
                                            </p>
                                        </Show>
                                    </Show>
                                </Show>
                                <div class="form-actions">
                                    <button
                                        class="button"
                                        disabled={command.isPending() || !canSend()}
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
                                    <Show
                                        when={
                                            !item().key &&
                                            item().category !== "announcement" &&
                                            (item().attemptLimit === undefined || !!item().approval)
                                        }
                                    >
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
                                                    setScheduledAt(undefined);
                                                    setHourlyInput(undefined);
                                                }, "Draft copied.")
                                            }
                                        >
                                            Duplicate
                                        </button>
                                    </Show>
                                    <Show
                                        when={
                                            !(isLegacy(item()) && item().status === "paused") &&
                                            ["queued", "scheduled", "paused"].includes(
                                                item().status,
                                            )
                                        }
                                    >
                                        <button
                                            class="button"
                                            disabled={
                                                command.isPending() ||
                                                !canOperate() ||
                                                (item().status === "paused" && !canSend())
                                            }
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
                                    <Show when={isQueueable(item())}>
                                        <button
                                            class="button button--primary"
                                            disabled={
                                                command.isPending() ||
                                                !canSend() ||
                                                scheduledAt() === "" ||
                                                (item().audience?.kind === "subscribers" &&
                                                    (!isHourlyValid() ||
                                                        !detail()?.recipients ||
                                                        isOverDailyLimit())) ||
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
                                        when={
                                            ["draft", "queued", "scheduled", "paused"].includes(
                                                item().status,
                                            ) && canOperate()
                                        }
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
