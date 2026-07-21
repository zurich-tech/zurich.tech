import { createAsync, useParams } from "@solidjs/router";
import type { JSX } from "solid-js";
import { For, Match, Show, Switch, createSignal } from "solid-js";

import { Button } from "../../component/button";
import { formatDate } from "../../component/calendar";
import { Field, Input } from "../../component/field";
import { FormMessage } from "../../component/form";
import { Markdown } from "../../component/markdown";
import { Tags } from "../../component/meta";
import { NotFound } from "../../component/notfound";
import { DetailList, DetailRow, Page, PageHeader, Section } from "../../component/page";
import { Seo } from "../../component/seo";
import { rsvp } from "../../data/actions";
import { getEvent, type PublicEvent } from "../../data/public";
import { errorMessage } from "../../error";
import { routeParam } from "../../route";

/** Event detail page. */
export default function Route() {
    // params
    const params = useParams();
    const slug = routeParam("slug", params.slug);

    // event
    const event = createAsync(() => getEvent(slug), { deferStream: true });
    const title = () => event()?.title ?? slug;

    // rsvp state
    const [rsvpError, setRsvpError] = createSignal<string>();
    const [rsvpSuccess, setRsvpSuccess] = createSignal<string>();
    const [isRsvpPending, setIsRsvpPending] = createSignal(false);

    // submit one registration
    async function submitRsvp(submitEvent: SubmitEvent) {
        submitEvent.preventDefault();

        const form = submitEvent.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const name = String(data.get("name") ?? "");
        const email = String(data.get("email") ?? "");

        // expose the accepted registration state
        setRsvpError(undefined);
        setRsvpSuccess(undefined);
        setIsRsvpPending(true);
        try {
            const result = await rsvp({ email, eventSlug: slug, name });
            const message = result.status === "waitlist" ? "added to waitlist." : "rsvp confirmed.";
            form.reset();
            setRsvpSuccess(message);
        } catch (caught) {
            setRsvpError(errorMessage(caught, "rsvp failed."));
        } finally {
            setIsRsvpPending(false);
        }
    }

    return (
        <Switch>
            {/* missing */}
            <Match when={event() === null}>
                <NotFound />
            </Match>

            {/* event */}
            <Match when={event() !== undefined}>
                <>
                    <Seo title={title()} description="Event." />
                    <Page width="narrow">
                        <PageHeader title={title()} />

                        {/* content */}
                        <div class="grid gap-8 md:grid-cols-[1fr_18rem]">
                            {/* main column */}
                            <div class="grid content-start gap-8">
                                <Description event={event()} />
                                <Show when={(event()?.agenda.length ?? 0) > 0}>
                                    <Agenda event={event()} />
                                </Show>
                                <Show when={(event()?.speakers.length ?? 0) > 0}>
                                    <Speakers event={event()} />
                                </Show>
                                <Show when={isRsvpOpen(event())}>
                                    <RsvpForm
                                        error={rsvpError()}
                                        event={event()}
                                        isPending={isRsvpPending()}
                                        onSubmit={submitRsvp}
                                        success={rsvpSuccess()}
                                    />
                                </Show>
                            </div>

                            {/* side column */}
                            <div class="grid content-start gap-8">
                                <Details event={event()} />
                            </div>
                        </div>

                        {/* photos */}
                        <Show when={(event()?.media.length ?? 0) > 0}>
                            <Photos event={event()} />
                        </Show>
                    </Page>
                </>
            </Match>
        </Switch>
    );
}

/** Event photos. */
function Photos(props: { event: PublicEvent | null | undefined }) {
    const [position, setPosition] = createSignal(0);
    let dialog: HTMLDialogElement | undefined;
    const images = () => props.event?.media ?? [];
    const image = () => images()[position()];

    /** Open one image in the full gallery. */
    function open(nextPosition: number) {
        if (dialog === undefined) {
            throw new Error("Event gallery is not mounted.");
        }

        setPosition(nextPosition);
        dialog.showModal();
    }

    /** Close the full gallery. */
    function close() {
        if (dialog === undefined) {
            throw new Error("Event gallery is not mounted.");
        }

        dialog.close();
    }

    /** Move through the gallery with wraparound. */
    function move(offset: number) {
        const count = images().length;
        if (count === 0) {
            throw new Error("Event gallery has no images.");
        }

        setPosition((current) => (current + offset + count) % count);
    }

    /** Handle gallery keyboard navigation. */
    function navigate(keyEvent: KeyboardEvent) {
        // previous image
        if (keyEvent.key === "ArrowLeft") {
            keyEvent.preventDefault();
            move(-1);
        }
        // next image
        else if (keyEvent.key === "ArrowRight") {
            keyEvent.preventDefault();
            move(1);
        }
        // close gallery
        else if (keyEvent.key === "Escape") {
            keyEvent.preventDefault();
            close();
        }
    }

    /** Close when the native dialog backdrop is selected. */
    function dismiss(mouseEvent: MouseEvent) {
        if (mouseEvent.target === dialog) {
            close();
        }
    }

    return (
        <Section title="photos" meta={String(images().length)}>
            {/* thumbnails */}
            <div class="event-photos">
                <For each={images()}>
                    {(thumbnail, index) => (
                        <button
                            aria-label={`Open photo ${index() + 1} of ${images().length}`}
                            class="event-photo"
                            onClick={() => open(index())}
                            type="button"
                        >
                            <img
                                alt={thumbnail.alt}
                                height={thumbnail.height}
                                loading="lazy"
                                src={thumbnail.thumbnailUrl}
                                width={thumbnail.width}
                            />
                        </button>
                    )}
                </For>
            </div>

            {/* full gallery */}
            <dialog
                aria-label={`Photos from ${props.event?.title ?? "event"}`}
                class="event-gallery"
                onClick={dismiss}
                onKeyDown={navigate}
                ref={(element) => (dialog = element)}
            >
                {/* gallery header */}
                <div class="event-gallery__header">
                    <span aria-live="polite">
                        {position() + 1} / {images().length}
                    </span>
                    <button
                        aria-label="Close gallery"
                        class="event-gallery__close"
                        onClick={close}
                        title="Close gallery"
                        type="button"
                    >
                        x
                    </button>
                </div>

                {/* selected image */}
                <div class="event-gallery__stage">
                    <Show when={images().length > 1}>
                        <button
                            aria-label="Previous photo"
                            class="event-gallery__previous"
                            onClick={() => move(-1)}
                            title="Previous photo"
                            type="button"
                        >
                            &lt;
                        </button>
                    </Show>

                    <Show when={image()}>
                        {(selected) => (
                            <figure>
                                <img
                                    alt={selected().alt}
                                    height={selected().height}
                                    src={selected().url}
                                    width={selected().width}
                                />

                                {/* caption */}
                                <Show when={selected().caption}>
                                    {(caption) => <figcaption>{caption()}</figcaption>}
                                </Show>
                            </figure>
                        )}
                    </Show>

                    <Show when={images().length > 1}>
                        <button
                            aria-label="Next photo"
                            class="event-gallery__next"
                            onClick={() => move(1)}
                            title="Next photo"
                            type="button"
                        >
                            &gt;
                        </button>
                    </Show>
                </div>
            </dialog>
        </Section>
    );
}

/** Event description. */
function Description(props: { event: PublicEvent | null | undefined }) {
    return (
        <Section title="about">
            <Markdown source={props.event?.description ?? "event not found."} />
        </Section>
    );
}

/** Event agenda. */
function Agenda(props: { event: PublicEvent | null | undefined }) {
    return (
        <Section title="agenda">
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
        </Section>
    );
}

/** RSVP form, legend shows the going/capacity gauge. */
function RsvpForm(props: {
    error?: string;
    event: PublicEvent | null | undefined;
    isPending: boolean;
    onSubmit: (submitEvent: SubmitEvent) => Promise<void>;
    success?: string;
}) {
    return (
        <Section title="rsvp" meta={rsvpGauge(props.event)}>
            <form class="grid gap-4" onSubmit={props.onSubmit}>
                <Field label="name">
                    <Input maxlength="120" name="name" placeholder="jane doe" required />
                </Field>

                <Field label="email">
                    <Input name="email" placeholder="you@example.com" required type="email" />
                </Field>

                <Button disabled={props.isPending} type="submit">
                    {props.isPending ? "registering..." : "rsvp"}
                </Button>
                <FormMessage error={props.error} success={props.success} />
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
            <div class="grid">
                <For each={props.event?.speakers ?? []}>
                    {(speaker) => (
                        <div class="border-b border-line py-3 text-sm first:pt-0 last:border-b-0 last:pb-0">
                            <p class="font-medium">{speaker.name}</p>

                            {/* affiliation */}
                            <Show when={speaker.title}>
                                {(title) => <p class="text-soft">{title()}</p>}
                            </Show>
                        </div>
                    )}
                </For>
            </div>
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

/** Whether the event accepts RSVPs. */
function isRsvpOpen(event: PublicEvent | null | undefined): boolean {
    return event?.status === "scheduled" || event?.status === "conditional";
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

/** RSVP gauge for the section heading, like "[###--] 47/80". */
function rsvpGauge(event: PublicEvent | null | undefined): string | undefined {
    if (event === null || event === undefined) {
        return undefined;
    }

    if (event.capacity === undefined) {
        return `${event.rsvpCount} going`;
    }

    return `${gaugeBlocks(event.rsvpCount, event.capacity)} ${event.rsvpCount}/${event.capacity}`;
}

/** Build the "[###--]" gauge string for a value against a max. */
function gaugeBlocks(value: number, max: number): string {
    if (max <= 0) {
        return "";
    }

    const filled = Math.max(0, Math.min(5, Math.round((5 * value) / max)));

    return `[${"#".repeat(filled)}${"-".repeat(5 - filled)}]`;
}
