import { createAsync } from "@solidjs/router";
import { For, Show } from "solid-js";

import type { CalendarEntry, PublicMember } from "../data/public";
import { getCalendar, getMembers } from "../data/public";
import { Badge } from "./badge";
import { DetailList, DetailRow, Page, PageHeader, Section } from "./page";
import { Seo } from "./seo";

/** Admin queue identifier. */
export type QueueKey = "email" | "events" | "members";

/** One record rendered inside an admin queue. */
type QueueRow = {
    href: string;
    meta?: string;
    status?: string;
    summary?: string;
    title: string;
};

const queueMeta: Record<QueueKey, { summary: string; title: string }> = {
    email: {
        summary: "broadcasts, reminders, notifications, and suppressions",
        title: "email",
    },
    events: {
        summary: "proposals, scheduled events, rsvps, and check-ins",
        title: "event review",
    },
    members: {
        summary: "imported subscribers, accounts, profiles, and roles",
        title: "members",
    },
};

/** Admin queue, a data-dense record list with a stats sidebar. */
export function Queue(props: { queue: QueueKey }) {
    // records
    const calendar = createAsync(() => getCalendar());
    const members = createAsync(() => getMembers());
    const meta = () => queueMeta[props.queue];
    const rows = () => queueRows(props.queue, calendar() ?? [], members() ?? []);

    return (
        <>
            <Seo title={meta().title} description={meta().summary} />
            <Page>
                <PageHeader summary={meta().summary} title={meta().title} />

                <div class="grid gap-6 lg:grid-cols-[1fr_16rem]">
                    {/* records */}
                    <Section title="records" meta={`${rows().length}`}>
                        <Show
                            when={rows().length > 0}
                            fallback={<p class="text-soft">nothing yet.</p>}
                        >
                            <ol class="grid">
                                <For each={rows()}>{(row) => <QueueRecord row={row} />}</For>
                            </ol>
                        </Show>
                    </Section>

                    {/* stats */}
                    <Section title="queue">
                        <DetailList>
                            <DetailRow label="queue" value={meta().title} />
                            <DetailRow label="records" value={rows().length} />
                            <DetailRow label="access" value="staff" />
                            <DetailRow label="status" value="active" />
                        </DetailList>
                    </Section>
                </div>
            </Page>
        </>
    );
}

/** One queue record: caret gutter, title, status badge, summary and meta. */
function QueueRecord(props: { row: QueueRow }) {
    return (
        <li class="-mx-2 border-b border-line last:border-b-0">
            <a
                class="group grid grid-cols-[16px_1fr] items-start gap-2 px-2 py-2 outline-none focus:bg-ink hover:bg-ink"
                href={props.row.href}
            >
                {/* caret */}
                <span class="text-transparent group-focus:text-paper group-hover:text-paper">
                    {">"}
                </span>

                {/* title, status, summary, meta */}
                <span class="grid gap-0.5">
                    <span class="flex flex-wrap items-baseline justify-between gap-3">
                        <span class="font-medium group-focus:text-paper group-hover:text-paper">
                            {props.row.title}
                        </span>
                        <Show when={props.row.status}>{(status) => <Badge>{status()}</Badge>}</Show>
                    </span>
                    <Show when={props.row.summary}>
                        <span class="text-[13px] text-soft group-focus:text-paper/60 group-hover:text-paper/60">
                            {props.row.summary}
                        </span>
                    </Show>
                    <Show when={props.row.meta}>
                        <span class="text-xs lowercase text-soft group-focus:text-paper/60 group-hover:text-paper/60">
                            {props.row.meta}
                        </span>
                    </Show>
                </span>
            </a>
        </li>
    );
}

/** Records for a given queue. */
function queueRows(
    queue: QueueKey,
    calendar: CalendarEntry[],
    members: PublicMember[],
): QueueRow[] {
    switch (queue) {
        case "email":
            return emailRows();
        case "events":
            return calendarRows(calendar);
        case "members":
            return memberRows(members);
    }
}

/** Email rows. */
function emailRows(): QueueRow[] {
    return [
        {
            href: "/settings",
            status: "newsletter",
            summary: "launch email for imported subscribers",
            title: "launch audience",
        },
        {
            href: "/events/zurich-ai-builders-night",
            status: "notification",
            summary: "reminder window for the next event",
            title: "event reminders",
        },
        {
            href: "/settings",
            status: "suppression",
            summary: "unsubscribes, bounces, and notification preferences",
            title: "preference center",
        },
    ];
}

/** Event rows. */
function calendarRows(entries: CalendarEntry[]): QueueRow[] {
    return entries.map((entry) => ({
        href: entry.href ?? `/events/${entry.slug}`,
        meta: entry.location,
        status: entry.status,
        summary: entry.summary ?? "calendar entry",
        title: entry.title,
    }));
}

/** Member rows. */
function memberRows(members: PublicMember[]): QueueRow[] {
    return members.map((member) => ({
        href: `/members/${member.handle}`,
        meta: `@${member.handle}`,
        summary: member.headline ?? "member",
        title: member.name,
    }));
}
