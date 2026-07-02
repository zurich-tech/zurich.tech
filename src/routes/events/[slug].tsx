import { createAsync, useParams } from "@solidjs/router";
import type { JSX } from "solid-js";
import { For, Show } from "solid-js";

import { Button } from "../../component/button";
import { formatDate } from "../../component/calendar";
import { Field, Input } from "../../component/field";
import { Tags } from "../../component/meta";
import { DetailList, DetailRow, Page, PageHeader, Section } from "../../component/page";
import { Seo } from "../../component/seo";
import { rsvp } from "../../data/actions";
import { getEvent, type PublicEvent } from "../../data/public";
import { routeParam } from "../../route";

/** Event detail page. */
export default function Route() {
    // params
    const params = useParams();
    const slug = routeParam("slug", params.slug);

    // event
    const event = createAsync(() => getEvent(slug));
    const title = () => event()?.title ?? slug;

    // rsvp
    async function submitRsvp(submitEvent: SubmitEvent) {
        submitEvent.preventDefault();

        const form = submitEvent.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const name = String(data.get("name") ?? "");
        const email = String(data.get("email") ?? "");

        // require identity
        if (name.length === 0 || email.length === 0) {
            return;
        }

        // submit rsvp
        await rsvp({ email, eventSlug: slug, name });
        form.reset();
    }

    return (
        <>
            <Seo title={title()} description="Event." />
            <Page width="narrow">
                <PageHeader summary={event()?.summary ?? "event not found."} title={title()} />

                {/* content */}
                <div class="grid gap-8 md:grid-cols-[1fr_18rem]">
                    {/* main column */}
                    <div class="grid content-start gap-8">
                        <Agenda event={event()} />
                        <RsvpForm event={event()} onSubmit={submitRsvp} />
                    </div>

                    {/* side column */}
                    <div class="grid content-start gap-8">
                        <Details event={event()} />
                        <Speakers event={event()} />
                    </div>
                </div>
            </Page>
        </>
    );
}

/** Event agenda. */
function Agenda(props: { event: PublicEvent | null | undefined }) {
    return (
        <Section title="agenda">
            <Show
                when={
                    props.event !== null &&
                    props.event !== undefined &&
                    props.event.agenda.length > 0
                }
                fallback={<p class="text-soft">no agenda.</p>}
            >
                <ol class="grid">
                    <For each={props.event?.agenda ?? []}>
                        {(item) => (
                            <li class="grid grid-cols-[4rem_1fr] gap-4 border-b border-line py-3 last:border-b-0">
                                <span class="text-xs whitespace-nowrap text-soft">{item.time}</span>
                                <span class="text-sm">{item.title}</span>
                            </li>
                        )}
                    </For>
                </ol>
            </Show>
        </Section>
    );
}

/** RSVP form, legend shows the going/capacity gauge. */
function RsvpForm(props: {
    event: PublicEvent | null | undefined;
    onSubmit: (submitEvent: SubmitEvent) => Promise<void>;
}) {
    return (
        <Section title="rsvp" meta={rsvpGauge(props.event)}>
            <form class="grid gap-4" onSubmit={props.onSubmit}>
                <Field label="name">
                    <Input name="name" placeholder="jane doe" />
                </Field>

                <Field label="email">
                    <Input name="email" placeholder="you@example.com" type="email" />
                </Field>

                <Button type="submit">rsvp</Button>
            </form>
        </Section>
    );
}

/** Event facts. */
function Details(props: { event: PublicEvent | null | undefined }) {
    return (
        <Section title="details">
            <DetailList>
                <DetailRow label="time" value={eventTime(props.event)} />
                <DetailRow label="location" value={props.event?.venue.name ?? "-"} />
                <DetailRow label="address" value={props.event?.venue.address ?? "-"} />
                <DetailRow label="format" value={props.event?.format ?? "event"} />
                <DetailRow label="status" value={statusLabel(props.event?.status)} />

                {/* tags */}
                <Show
                    when={
                        props.event !== null &&
                        props.event !== undefined &&
                        props.event.tags.length > 0
                    }
                >
                    <DetailRow label="tags" value={<Tags values={props.event?.tags ?? []} />} />
                </Show>

                {/* access notes */}
                <Show when={props.event?.venue.access}>
                    <DetailRow label="access" value={props.event?.venue.access ?? "-"} />
                </Show>
            </DetailList>
        </Section>
    );
}

/** Event speakers. */
function Speakers(props: { event: PublicEvent | null | undefined }) {
    return (
        <Section title="speakers">
            <Show
                when={
                    props.event !== null &&
                    props.event !== undefined &&
                    props.event.speakers.length > 0
                }
                fallback={<p class="text-soft">no speakers yet.</p>}
            >
                <div class="grid">
                    <For each={props.event?.speakers ?? []}>
                        {(speaker) => (
                            <div class="border-b border-line py-3 text-sm first:pt-0 last:border-b-0 last:pb-0">
                                <p class="font-medium">{speaker.name}</p>
                                <p class="text-soft">{speaker.title}</p>
                            </div>
                        )}
                    </For>
                </div>
            </Show>
        </Section>
    );
}

/** Event time label. */
function eventTime(event: PublicEvent | null | undefined): string {
    if (event === null || event === undefined) {
        return "-";
    }

    return formatDate(event.startsAt);
}

/** RSVP capacity, falling back to the current count when uncapped. */
function eventCapacity(event: PublicEvent): number {
    return event.capacity ?? Math.max(1, event.rsvpCount);
}

/** Status label, bracketing conditional and cancelled states like "[conditional]". */
function statusLabel(status: string | undefined): string {
    if (status === undefined) {
        return "draft";
    }
    if (status === "conditional" || status === "cancelled") {
        return `[${status}]`;
    }

    return status;
}

/** Text-block RSVP gauge for the section legend, like "███░░ 47/80". */
function rsvpGauge(event: PublicEvent | null | undefined): string | undefined {
    if (event === null || event === undefined) {
        return undefined;
    }

    const capacity = eventCapacity(event);

    return `${gaugeBlocks(event.rsvpCount, capacity)} ${event.rsvpCount}/${capacity}`;
}

/** Build the "███░░" gauge string for a value against a max. */
function gaugeBlocks(value: number, max: number): string {
    if (max <= 0) {
        return "";
    }

    const filled = Math.max(0, Math.min(5, Math.round((5 * value) / max)));

    return "█".repeat(filled) + "░".repeat(5 - filled);
}
