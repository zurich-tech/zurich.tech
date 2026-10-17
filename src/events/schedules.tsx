import { PillRow } from "../components/filter-pills";
import { useAccess } from "../auth/edit";
import { FormSection, savedEditor, Editor, FormMessage } from "../components/form";
import { DeleteRecord } from "./delete";
import { useConfirmation } from "../components/dialog";
import "./schedules.css";
import { isTentative } from "../../convex/events/conditions";
import { createResource, createSignal, For, Show } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { Card } from "../components/card";
import { useWorkspaceCommand, type EventWorkspace } from "../app/workspace";
import { civilTime } from "../../convex/events/time";

/** A schedule and the occurrences already generated from it. */
type Schedule = FunctionReturnType<typeof api.events.schedules.list>[number];
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Manage recurrence alongside the series catalogue. */
export function Schedules(props: { workspace: EventWorkspace }) {
    const confirm = useConfirmation();
    const [params, setParams] = useSearchParams();
    const [schedules, { refetch }] = createResource(async () =>
        (await memberClient()).query(api.events.schedules.list, {}),
    );
    const selected = () =>
        typeof params.schedule === "string" ? params.schedule : params.source ? "new" : undefined;
    const item = () => schedules()?.find((schedule) => schedule._id === selected());
    const command = useWorkspaceCommand(refetch);

    /** Save new defaults without rewriting individually edited occurrences. */
    async function save(event: SubmitEvent) {
        event.preventDefault();
        const editor = event.currentTarget as HTMLFormElement;
        const form = new FormData(event.currentTarget as HTMLFormElement);
        const text = (name: string) => String(form.get(name) ?? "");
        const isPublished = text("publication") === "published";
        const isActive = text("status") === "active";
        const template = text("sourceId")
            ? props.workspace.submissions.find((draft) => draft._id === text("sourceId"))
            : item()?.template;
        if (
            isActive &&
            isPublished &&
            !(await confirm({
                title: "Publish scheduled events",
                action: "Publish events",
                description:
                    "Publish occurrences for the next six weeks. Existing occurrences keep their details.",
                emails: 0,
                details: template?.followUp?.isEnabled
                    ? `Each occurrence will send a follow-up ${template.followUp.delayHours} hours after it ends, to ${template.checkIn?.isEnabled ? "checked-in attendees" : "confirmed registrants"}.`
                    : undefined,
            }))
        )
            return;
        await command.perform(async () => {
            const id = await (
                await memberClient()
            ).mutation(api.events.schedules.save, {
                id: item()?._id,
                seriesId: text("seriesId") as Id<"series">,
                title: text("title"),
                sourceId: text("sourceId") ? (text("sourceId") as Id<"submissions">) : undefined,
                status: isActive ? "active" : "paused",
                publication: isPublished ? "published" : "draft",
                recurrence: {
                    frequency: text("frequency") as "daily" | "weekly" | "monthly",
                    interval: Number(text("interval")),
                    weekdays: form.getAll("weekday").map(Number),
                    start: text("start"),
                    end: text("end") || undefined,
                    time: text("time"),
                    timezone: "Europe/Zurich",
                    excluded: text("excluded")
                        .split(/[,\s]+/)
                        .filter(Boolean),
                },
            });
            savedEditor(editor);
            setParams({ schedule: id, source: undefined });
        }, "Schedule saved.");
    }

    /** Require a fresh recipient count before the once-only launch announcement. */
    async function announce(schedule: Schedule) {
        await command.perform(async () => {
            const client = await memberClient();
            const preview = await client.query(api.events.schedules.announcement, {
                id: schedule._id,
            });
            if (
                !(await confirm({
                    title: "Announce series",
                    action: "Send announcement",
                    description: "Announce this recurring series to subscribers.",
                    emails: preview.recipients,
                    recipients: preview.recipients,
                    audience: "subscribers",
                    details: "Future occurrences won’t send individual announcements.",
                }))
            )
                return false;
            await client.mutation(api.events.schedules.announce, {
                id: schedule._id,
                receipt: preview.receipt,
            });
        }, "Announcement queued.");
    }

    return (
        <Card
            title={selected() === "new" ? "New schedule" : item() ? "Edit schedule" : "Schedules"}
            toolbar={
                <>
                    <button
                        class="action-link"
                        onClick={() =>
                            setParams({
                                schedule: selected() ? undefined : "new",
                                source: undefined,
                            })
                        }
                    >
                        {selected() ? "Back" : "New schedule"}
                    </button>
                    <Show when={item()}>
                        {(schedule) => (
                            <DeleteRecord
                                id={schedule()._id}
                                name="schedule"
                                onDeleted={async () => {
                                    setParams({ schedule: undefined });
                                    await refetch();
                                }}
                            />
                        )}
                    </Show>
                    <Show when={selected() === "new" || item()}>
                        <button
                            class="button button--primary"
                            type="submit"
                            form="schedule-editor"
                            disabled={command.isPending()}
                        >
                            {command.isPending() ? "Saving…" : "Save"}
                        </button>
                    </Show>
                </>
            }
        >
            <FormMessage
                error={
                    command.error() || (schedules.error ? "Could not load schedules." : undefined)
                }
                success={command.success()}
            />
            <Show
                when={!schedules.error}
                fallback={
                    <button class="button" onClick={() => void refetch()}>
                        Retry
                    </button>
                }
            >
                <Show
                    when={selected()}
                    fallback={
                        <Show when={schedules()?.length} fallback={<p>No schedules</p>}>
                            <div class="table-scroll">
                                <table class="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Event</th>
                                            <th>Recurrence</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={schedules()}>
                                            {(schedule) => (
                                                <tr>
                                                    <td>
                                                        {schedule.template.title}
                                                        <Show when={schedule.errors?.length}>
                                                            <p class="form-error">
                                                                {schedule.errors!.join(" ")}
                                                            </p>
                                                        </Show>
                                                    </td>
                                                    <td>
                                                        {schedule.recurrence.frequency === "weekly"
                                                            ? schedule.recurrence.weekdays
                                                                  .map((day) =>
                                                                      weekdays[day].slice(0, 3),
                                                                  )
                                                                  .join(", ")
                                                            : schedule.recurrence.frequency ===
                                                                "daily"
                                                              ? "Daily"
                                                              : "Monthly"}{" "}
                                                        · {schedule.recurrence.time}
                                                    </td>
                                                    <td>
                                                        {schedule.status === "active"
                                                            ? "Active"
                                                            : "Paused"}
                                                    </td>
                                                    <td>
                                                        <div class="admin-actions">
                                                            <button
                                                                class="button"
                                                                onClick={() =>
                                                                    setParams({
                                                                        schedule: schedule._id,
                                                                    })
                                                                }
                                                            >
                                                                Edit
                                                            </button>
                                                            <Show
                                                                when={
                                                                    !schedule.announcedAt &&
                                                                    schedule.status === "active" &&
                                                                    schedule.publication ===
                                                                        "published"
                                                                }
                                                            >
                                                                <button
                                                                    class="button"
                                                                    disabled={command.isPending()}
                                                                    onClick={() =>
                                                                        void announce(schedule)
                                                                    }
                                                                >
                                                                    Announce
                                                                </button>
                                                            </Show>
                                                        </div>
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
                    <Show when={selected() === "new" || item()}>
                        <ScheduleForm
                            item={item()}
                            seriesId={typeof params.series === "string" ? params.series : undefined}
                            sourceId={typeof params.source === "string" ? params.source : undefined}
                            workspace={props.workspace}
                            onSubmit={save}
                            isPending={command.isPending()}
                        />
                        <Show when={item()?.errors?.length}>
                            <p class="form-error">{item()!.errors!.join(" ")}</p>
                        </Show>
                        <Show when={item()?.events.length}>
                            <div class="table-scroll schedule-occurrences">
                                <table class="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Occurrence</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For
                                            each={item()?.events.filter(
                                                (event) => event.startsAt > Date.now(),
                                            )}
                                        >
                                            {(event) => (
                                                <tr>
                                                    <td>
                                                        {new Date(event.startsAt).toLocaleString(
                                                            "en-GB",
                                                            {
                                                                timeZone: "Europe/Zurich",
                                                                day: "numeric",
                                                                month: "short",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            },
                                                        )}
                                                    </td>
                                                    <td>
                                                        {event.status === "draft"
                                                            ? "Draft"
                                                            : event.status === "cancelled"
                                                              ? "Cancelled"
                                                              : isTentative(event)
                                                                ? "Tentative"
                                                                : "Published"}
                                                    </td>
                                                    <td>
                                                        <a
                                                            class="action-link"
                                                            href={`/submit?event=${event.id}`}
                                                        >
                                                            Edit
                                                        </a>
                                                    </td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                        </Show>
                    </Show>
                </Show>
            </Show>
        </Card>
    );
}

/** Edit a recurrence with a saved event as its complete reusable template. */
function ScheduleForm(props: {
    item?: Schedule;
    sourceId?: string;
    seriesId?: string;
    workspace: EventWorkspace;
    isPending: boolean;
    onSubmit: (event: SubmitEvent) => void;
}) {
    const [frequency, setFrequency] = createSignal(props.item?.recurrence.frequency ?? "weekly");
    const [sourceId, setSourceId] = createSignal(props.sourceId ?? "");
    const source = () => props.workspace.submissions.find((row) => row._id === sourceId());
    const start = () =>
        props.item?.recurrence.start ?? civilTime(source()?.startsAt ?? Date.now()).slice(0, 10);
    const [days, setDays] = createSignal(props.item?.recurrence.weekdays ?? [4]);
    const [excluded, setExcluded] = createSignal(props.item?.recurrence.excluded ?? []);
    const [skip, setSkip] = createSignal("");
    const access = useAccess();
    const [directory] = createResource(async () =>
        (await memberClient()).query(api.organisations.queries.directory, {}),
    );
    return (
        <Editor
            id="schedule-editor"
            class="editor"
            onSubmit={props.onSubmit}
            actions={() => (
                <div class="form-actions">
                    <button class="button button--primary" disabled={props.isPending}>
                        {props.isPending ? "Saving…" : "Save"}
                    </button>
                    <a class="button" href="/submit">
                        New template event
                    </a>
                </div>
            )}
        >
            <label>
                Occurrence title
                <input
                    name="title"
                    required
                    value={props.item?.template.title ?? source()?.title ?? ""}
                    placeholder="Zurich Tech Dinner #${count}"
                />
                <span>Use {"${count}"} for the occurrence number.</span>
            </label>
            <div class="form-columns">
                <label>
                    Series
                    <select
                        required
                        name="seriesId"
                        value={props.item?.seriesId ?? props.seriesId ?? source()?.seriesId ?? ""}
                    >
                        <option value="">Choose a series</option>
                        <For
                            each={directory()?.series.filter(
                                (series) =>
                                    access.canSeries(series._id, "organiser") &&
                                    (series.status !== "archived" ||
                                        series._id === props.item?.seriesId),
                            )}
                        >
                            {(series) => (
                                <option
                                    value={series._id}
                                    selected={
                                        series._id ===
                                        (props.item?.seriesId ??
                                            props.seriesId ??
                                            source()?.seriesId)
                                    }
                                >
                                    {series.name}
                                </option>
                            )}
                        </For>
                    </select>
                </label>
                <label>
                    Template
                    <select
                        name="sourceId"
                        required={!props.item}
                        value={sourceId()}
                        onChange={(event) => setSourceId(event.currentTarget.value)}
                    >
                        <option value="">
                            {props.item ? "Keep current template" : "Choose a saved event"}
                        </option>
                        <For each={props.workspace.submissions}>
                            {(event) => (
                                <option value={event._id}>
                                    {event.title} · {civilTime(event.startsAt).slice(0, 10)}
                                </option>
                            )}
                        </For>
                    </select>
                </label>
            </div>
            <div class="form-columns">
                <label>
                    Repeat
                    <select
                        name="frequency"
                        value={frequency()}
                        onChange={(event) =>
                            setFrequency(
                                event.currentTarget.value as "daily" | "weekly" | "monthly",
                            )
                        }
                    >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                </label>
                <label>
                    Every (
                    {frequency() === "daily"
                        ? "days"
                        : frequency() === "weekly"
                          ? "weeks"
                          : "months"}
                    )
                    <input
                        required
                        type="number"
                        name="interval"
                        min="1"
                        max="52"
                        step="1"
                        value={props.item?.recurrence.interval ?? 1}
                    />
                </label>
            </div>
            <Show when={frequency() === "weekly"}>
                <PillRow label="Weekdays">
                    <For each={weekdays}>
                        {(day, index) => (
                            <>
                                <button
                                    type="button"
                                    classList={{ selected: days().includes(index()) }}
                                    aria-pressed={days().includes(index())}
                                    aria-label={day}
                                    onClick={() =>
                                        setDays(
                                            days().includes(index())
                                                ? days().filter((value) => value !== index())
                                                : [...days(), index()].sort(),
                                        )
                                    }
                                >
                                    {day.slice(0, 3)}
                                </button>
                                <Show when={days().includes(index())}>
                                    <input type="hidden" name="weekday" value={index()} />
                                </Show>
                            </>
                        )}
                    </For>
                </PillRow>
            </Show>
            <div class="form-columns">
                <label>
                    First date
                    <input required type="date" name="start" value={start()} />
                </label>
                <label>
                    Time
                    <input
                        required
                        type="time"
                        name="time"
                        value={
                            props.item?.recurrence.time ??
                            (source() ? civilTime(source()!.startsAt).slice(11) : "19:00")
                        }
                    />
                </label>
            </div>
            <Show when={frequency() === "monthly"}>
                <p class="field-hint">
                    Same day of the month. Months without that date are skipped.
                </p>
            </Show>
            <div class="form-columns">
                <label>
                    Last date
                    <input type="date" name="end" value={props.item?.recurrence.end ?? ""} />
                </label>
                <label>
                    New occurrences
                    <select name="publication" value={props.item?.publication ?? "draft"}>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                    </select>
                </label>
            </div>
            <label>
                Schedule
                <select name="status" value={props.item?.status ?? "active"}>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                </select>
            </label>
            <FormSection title="Skipped dates">
                <input type="hidden" name="excluded" value={excluded().join(",")} />
                <div class="form-columns">
                    <label>
                        Date
                        <input
                            type="date"
                            value={skip()}
                            onInput={(event) => setSkip(event.currentTarget.value)}
                        />
                    </label>
                    <div class="schedule-skip">
                        <button
                            class="button"
                            type="button"
                            disabled={!skip()}
                            onClick={() => {
                                setExcluded([...new Set([...excluded(), skip()])].sort());
                                setSkip("");
                            }}
                        >
                            Skip date
                        </button>
                    </div>
                </div>
                <PillRow label="Skipped dates">
                    <For each={excluded()}>
                        {(date) => (
                            <button
                                type="button"
                                aria-label={`Remove skipped date ${date}`}
                                onClick={() =>
                                    setExcluded(excluded().filter((value) => value !== date))
                                }
                            >
                                {date} ×
                            </button>
                        )}
                    </For>
                </PillRow>
            </FormSection>
            <p class="field-hint">
                Generates six weeks ahead. Existing occurrences keep their details; edit or cancel
                them individually.
            </p>
        </Editor>
    );
}
