import { SocialLinks } from "../../component/social";
import { Image } from "../../component/image";
import { timeZone } from "../../core/constants";
import { getEvent, type PublicEvent } from "../../core/queries";

import { VenueMap } from "../../component/venue";
import { Card } from "../../component/card";
import { isCurrentYear } from "../../core/time";
import { Arrow } from "../../component/arrow";
import { createAsync, useParams } from "@solidjs/router";
import { For, Match, Show, Switch, createSignal } from "solid-js";

import { Button } from "../../component/button";
import { Field, Input } from "../../component/field";
import { FormMessage } from "../../component/form";
import { Markdown } from "../../component/markdown";
import { NotFound } from "../../component/notfound";
import { DetailList, DetailRow, Page, PageHeader } from "../../component/page";
import { Seo } from "../../component/seo";
import { rsvp } from "../../core/registration";

import { errorMessage } from "../../core/error";
import { routeParam } from "../../core/route";

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

    /** Request email confirmation for one event registration. */
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
            const policy = event()?.registration;
            const answers =
                policy?.kind === "native"
                    ? policy.questions.map((_, index) => String(data.get(`answer-${index}`) ?? ""))
                    : [];
            await rsvp({ email, eventSlug: slug, name, answers });
            const message = "Check your inbox to confirm.";
            form.reset();
            setRsvpSuccess(message);
        } catch (caught) {
            setRsvpError(errorMessage(caught, "Could not register."));
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
                    <Seo
                        title={title()}
                        description={event()?.summary ?? event()?.title ?? "Event"}
                        image={event()?.media[0]?.url}
                    />
                    <Page class="event-page">
                        <a class="eyebrow" href="/events">
                            <Arrow direction="left" /> Events
                        </a>
                        <header class="event-heading">
                            <div class="event-schedule">
                                <time dateTime={new Date(event()!.startsAt).toISOString()}>
                                    {eventTime(event())}
                                </time>
                                <Show when={event()?.status === "cancelled"}>
                                    <span class="tag">Cancelled</span>
                                </Show>
                                <Show
                                    when={
                                        event()?.status !== "cancelled" &&
                                        event()!.startsAt < Date.now()
                                    }
                                >
                                    <span class="tag">Past event</span>
                                </Show>
                                <Show
                                    when={
                                        event()?.status === "scheduled" &&
                                        event()!.startsAt > Date.now()
                                    }
                                >
                                    <span class="tag tag-upcoming">Upcoming</span>
                                </Show>
                                <Show when={event()?.registration?.kind === "external"}>
                                    <span class="tag tag-external">
                                        External <Arrow direction="external" />
                                    </span>
                                </Show>
                            </div>

                            <PageHeader title={title()} />
                            <Show when={event()?.summary}>
                                <p class="page-lead">{event()?.summary}</p>
                            </Show>
                        </header>

                        {/* content */}
                        <div class="event-layout">
                            {/* main column */}
                            <div class="event-content">
                                <Show
                                    when={event()?.description?.trim() !== event()?.summary?.trim()}
                                >
                                    <Description event={event()} />
                                </Show>
                                <Show when={(event()?.agenda.length ?? 0) > 0}>
                                    <Agenda event={event()} />
                                </Show>
                                <Show when={(event()?.speakers.length ?? 0) > 0}>
                                    <Speakers event={event()} />
                                </Show>
                                <Show
                                    when={
                                        event()?.registration?.kind === "native" &&
                                        event()?.status === "scheduled" &&
                                        event()!.startsAt > Date.now() &&
                                        !isRsvpOpen(event())
                                    }
                                >
                                    <Card title="Registration">
                                        <p>{registrationNotice(event())}</p>
                                    </Card>
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
                            <aside class="event-aside">
                                <Details event={event()} />
                                <Show
                                    when={
                                        event()?.registration?.kind === "external" &&
                                        event()?.status !== "cancelled" &&
                                        (event()?.startsAt ?? 0) > Date.now()
                                    }
                                >
                                    <a
                                        class="button button--primary"
                                        href={(event()?.registration as { url: string }).url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Register on organiser’s site <Arrow direction="external" />
                                    </a>
                                </Show>
                                <Show
                                    when={
                                        event()?.registration?.kind === "none" &&
                                        event()?.status === "scheduled" &&
                                        (event()?.startsAt ?? 0) > Date.now()
                                    }
                                >
                                    <p>No registration required. Come along.</p>
                                </Show>
                                <Show
                                    when={
                                        event()!.startsAt > Date.now() &&
                                        event()?.status !== "cancelled"
                                    }
                                >
                                    <a
                                        class="button"
                                        href={`/calendar/${slug}`}
                                        download={`${slug}.ics`}
                                    >
                                        Add to calendar <Arrow direction="down" />
                                    </a>
                                </Show>
                                <Show when={(event()?.organisations.length ?? 0) > 0}>
                                    <Card title="Hosts & supporters">
                                        <For each={event()?.organisations}>
                                            {(organisation) => (
                                                <Show when={organisation}>
                                                    {(item) => (
                                                        <a
                                                            class="text-link"
                                                            href={`/organisations/${item().slug}`}
                                                        >
                                                            {item().name}{" "}
                                                            <Arrow direction="external" />
                                                        </a>
                                                    )}
                                                </Show>
                                            )}
                                        </For>
                                    </Card>
                                </Show>
                                <Show when={(event()?.links.length ?? 0) > 0}>
                                    <Card title="Links">
                                        <For each={event()?.links}>
                                            {(link) => (
                                                <p>
                                                    <a
                                                        class="text-link"
                                                        href={link.href}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        {link.label} <Arrow direction="external" />
                                                    </a>
                                                </p>
                                            )}
                                        </For>
                                    </Card>
                                </Show>
                            </aside>
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
        <Card title="Photos" id="photos" meta={String(images().length)}>
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
                            <Image
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
                {/* identify the album and keep dismissal easy to find */}
                <div class="event-gallery__header">
                    <h2>{props.event?.title}</h2>
                    <button
                        aria-label="Close gallery"
                        class="button button--ghost"
                        onClick={close}
                        type="button"
                        autofocus
                    >
                        Close <span aria-hidden="true">×</span>
                    </button>
                </div>

                {/* give the photograph the full panel width without cropping */}
                <div class="event-gallery__stage">
                    <Show when={image()}>
                        {(selected) => (
                            <figure>
                                <Image
                                    alt={selected().alt}
                                    height={selected().height}
                                    src={selected().url}
                                    width={selected().width}
                                />
                                <Show when={selected().caption}>
                                    {(caption) => <figcaption>{caption()}</figcaption>}
                                </Show>
                            </figure>
                        )}
                    </Show>
                </div>

                {/* keep navigation in one stable row below the photograph */}
                <div class="event-gallery__footer">
                    <button
                        aria-label="Previous photo"
                        class="button button--ghost"
                        disabled={images().length < 2}
                        onClick={() => move(-1)}
                        type="button"
                    >
                        <Arrow direction="left" /> Previous
                    </button>
                    <span aria-live="polite" aria-atomic="true">
                        {position() + 1} / {images().length}
                    </span>
                    <button
                        aria-label="Next photo"
                        class="button button--ghost"
                        disabled={images().length < 2}
                        onClick={() => move(1)}
                        type="button"
                    >
                        Next <Arrow />
                    </button>
                </div>
            </dialog>
        </Card>
    );
}

/** Event description. */
function Description(props: { event: PublicEvent | null | undefined }) {
    return (
        <Card title="About">
            <Markdown source={props.event?.description ?? "event not found."} />
        </Card>
    );
}

/** Event agenda. */
function Agenda(props: { event: PublicEvent | null | undefined }) {
    return (
        <Card title="Programme">
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
        </Card>
    );
}

/** Register or apply to attend a native event. */
function RsvpForm(props: {
    error?: string;
    event: PublicEvent | null | undefined;
    isPending: boolean;
    onSubmit: (submitEvent: SubmitEvent) => Promise<void>;
    success?: string;
}) {
    return (
        <Card
            title={
                props.event?.registration?.kind === "native" &&
                props.event.registration.admission === "approval"
                    ? "Apply to attend"
                    : props.event?.registration?.kind === "native" &&
                        props.event.registration.capacity !== null &&
                        props.event.rsvpCount >= props.event.registration.capacity
                      ? "Join the waitlist"
                      : "Register"
            }
        >
            <form class="grid gap-4" onSubmit={props.onSubmit}>
                <Field label="Name">
                    <Input maxlength="120" name="name" placeholder="Your name" required />
                </Field>

                <Field label="Email">
                    <Input name="email" placeholder="you@example.com" required type="email" />
                </Field>

                <Show when={props.event?.registration?.kind === "native"}>
                    <For
                        each={
                            (
                                props.event?.registration as {
                                    questions: { label: string; isRequired: boolean }[];
                                }
                            ).questions
                        }
                    >
                        {(question, index) => (
                            <Field label={question.label}>
                                <Input
                                    name={`answer-${index()}`}
                                    required={question.isRequired}
                                    maxlength="2000"
                                />
                            </Field>
                        )}
                    </For>
                </Show>
                <p class="text-sm text-soft">We’ll email you a confirmation link.</p>
                <Button disabled={props.isPending} type="submit">
                    {props.isPending ? "Sending…" : "Continue by email"}
                </Button>
                <FormMessage error={props.error} success={props.success} />
            </form>
        </Card>
    );
}

/** Present the venue and practical arrival details. */
function Details(props: { event: PublicEvent | null | undefined }) {
    return (
        <Card title="Venue">
            <DetailList>
                <DetailRow label="Location" value={props.event?.venue.name} />
                <Show when={props.event?.venue.address}>
                    <DetailRow label="Address" value={props.event?.venue.address} />
                </Show>
                <Show when={props.event?.venue.access}>
                    <DetailRow label="Access" value={props.event?.venue.access} />
                </Show>
            </DetailList>
            <Show
                when={props.event?.venue.coordinates}
                fallback={
                    <Show when={props.event?.venue.name}>
                        <a
                            class="text-link venue-search"
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(props.event!.venue.address ?? props.event!.venue.name!)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Find on map <Arrow direction="external" />
                        </a>
                    </Show>
                }
            >
                {(coordinates) => (
                    <VenueMap
                        name={props.event?.venue.name ?? "Event venue"}
                        coordinates={coordinates()}
                    />
                )}
            </Show>
        </Card>
    );
}

/** Event speakers. */
function Speakers(props: { event: PublicEvent | null | undefined }) {
    return (
        <Card title="Speakers">
            <div class="speaker-list">
                <For each={props.event?.speakers ?? []}>
                    {(speaker) => (
                        <div class="speaker">
                            <Show when={speaker.imageUrl}>
                                <Image
                                    class="speaker-portrait"
                                    src={speaker.imageUrl}
                                    darkSrc={speaker.imageDarkUrl}
                                    alt={speaker.name}
                                    width={80}
                                    height={80}
                                    loading="lazy"
                                />
                            </Show>
                            <p class="speaker-name">{speaker.name}</p>

                            {/* affiliation */}
                            <Show when={speaker.title}>
                                {(title) => <p class="text-soft">{title()}</p>}
                            </Show>
                            <SocialLinks name={speaker.name} profiles={speaker.links} />
                        </div>
                    )}
                </For>
            </div>
        </Card>
    );
}

/** Event time label. */
function eventTime(event: PublicEvent | null | undefined): string {
    if (event === null || event === undefined) {
        return "-";
    }

    const date = new Date(event.startsAt);
    const day = date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: isCurrentYear(event.startsAt) ? undefined : "numeric",
        timeZone,
    });
    const time = date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
    });

    return `${day} · ${time} · Zürich time`;
}

/** Whether the event accepts RSVPs. */
function isRsvpOpen(event: PublicEvent | null | undefined): boolean {
    return (
        event?.status === "scheduled" &&
        event.startsAt > Date.now() &&
        event.registration?.kind === "native" &&
        (event.registration.overflow !== "closed" ||
            event.registration.capacity === null ||
            event.rsvpCount < event.registration.capacity) &&
        (event.registration.closesAt === undefined || event.registration.closesAt > Date.now())
    );
}

/** Explain why a future native event cannot accept another registration. */
function registrationNotice(event: PublicEvent | null | undefined): string {
    const policy = event?.registration;

    return policy?.kind === "native" &&
        policy.closesAt !== undefined &&
        policy.closesAt <= Date.now()
        ? "Registration is closed."
        : "This event is full.";
}
