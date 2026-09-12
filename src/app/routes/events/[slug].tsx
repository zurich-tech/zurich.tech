import { EventTags } from "../../../events/tags";
import { EventCounts } from "../../../events/counts";
import { ConfirmationNotice } from "../../../events/confirmation";
import { isTentative } from "../../../../convex/events/conditions";
import { useAccount } from "../../../auth";
import { memberClient } from "../../../auth/convex";
import { api } from "../../../../convex/_generated/api";
import { TeamEdit } from "../../../auth/edit";
import { SocialLinks } from "../../../components/social";
import { Image } from "../../../components/image";
import { Share } from "../../../components/share";
import { site, timeZone } from "../../site";
import { getEvent, useConfirmationRefresh, type PublicEvent } from "../../../events/queries";

import { VenueMap } from "../../../map/venue";
import { Card } from "../../../components/card";
import { isCurrentYear } from "../../../events/time";
import { Arrow } from "../../../components/arrow";
import { createAsync, useParams, revalidate } from "@solidjs/router";
import {
    startTransition,
    For,
    Match,
    Show,
    Switch,
    createSignal,
    createResource,
    onMount,
    onCleanup,
} from "solid-js";

import { Button } from "../../../components/button";
import { Field, Input } from "../../../components/field";
import { FormMessage } from "../../../components/form";
import { Markdown } from "../../../components/markdown";
import { NotFound } from "../../notfound";
import { DetailList, DetailRow, Page, ItemHeader } from "../../page";
import { Seo } from "../../seo";
import { rsvp } from "../../../events/registration";

import { errorMessage } from "../../../components/errors";
import { routeParam } from "../../params";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: ({ params }: { params: Record<string, string> }) => getEvent(params.slug),
};

/** Event detail page. */
export default function Route() {
    const account = useAccount();
    // params
    const params = useParams();
    const slug = () => routeParam("slug", params.slug);

    // event
    const event = createAsync(() => getEvent(slug()), { deferStream: true });
    const title = () => event()?.title ?? slug();
    useConfirmationRefresh(
        () => !!event() && event()!.status === "scheduled" && isTentative(event()!),
        () => revalidate(getEvent.key),
    );

    const registrationKey = () => (account.user() ? `${account.user()!.id}:${slug()}` : undefined);
    const [registration, { refetch: refreshRegistration }] = createResource(
        registrationKey,
        async (key) => {
            const eventSlug = slug();
            const value = await (
                await memberClient()
            ).query(api.events.registrations.current, { eventSlug });
            return { key, value };
        },
    );
    // retain refreshes only while they belong to this account and event
    const registrationResult = () =>
        !registration.error && registration.state !== "pending" ? registration.latest : undefined;
    const isCurrentRegistration = () =>
        !!registrationKey() && registrationResult()?.key === registrationKey();
    const isRegistrationLoading = () =>
        account.isPending() ||
        (!!account.user() && !registration.error && !isCurrentRegistration());
    const currentRegistration = () =>
        isCurrentRegistration() ? registrationResult()?.value : undefined;
    const hasRegistration = () =>
        !!currentRegistration() && currentRegistration()?.status !== "cancelled";

    // refresh after returning from the registration management page
    onMount(() => {
        const refresh = () => {
            if (account.user()) void startTransition(refreshRegistration);
        };
        window.addEventListener("focus", refresh);
        onCleanup(() => window.removeEventListener("focus", refresh));
    });

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
            const message = account.user()
                ? await (
                      await memberClient()
                  ).action(api.events.registrations.join, { eventSlug: slug(), answers })
                : (await rsvp({ email, eventSlug: slug(), name, answers }),
                  "Check your inbox to confirm.");
            if (account.user())
                await startTransition(async () => {
                    await Promise.all([refreshRegistration(), revalidate(getEvent.key)]);
                });
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
                        <ItemHeader
                            title={title()}
                            summary={event()?.summary}
                            actions={
                                <div class="row-actions">
                                    <TeamEdit eventId={event()!.id} />
                                    <Show when={event()!.checkIn?.isEnabled}>
                                        <TeamEdit
                                            href={`/checkin?event=${event()!.id}`}
                                            label="Check in"
                                        />
                                    </Show>
                                    <Show
                                        when={
                                            event()!.feedback?.isEventEnabled ||
                                            event()!.feedback?.isSpeakerEnabled
                                        }
                                    >
                                        <TeamEdit
                                            href={`/feedback?event=${event()!.id}`}
                                            label="Feedback"
                                        />
                                    </Show>
                                </div>
                            }
                        >
                            <Show when={event()?.status === "cancelled"}>
                                <span class="tag">Cancelled</span>
                            </Show>
                            <Show
                                when={
                                    event()?.status !== "cancelled" &&
                                    event()!.startsAt < Date.now()
                                }
                            >
                                <span class="tag">Past</span>
                            </Show>
                            <Show
                                when={
                                    event()?.status === "scheduled" &&
                                    event()!.startsAt > Date.now()
                                }
                            >
                                <span class="tag tag-upcoming">
                                    {isTentative(event()!) ? "Tentative" : "Upcoming"}
                                </span>
                            </Show>
                            <Show when={event()?.registration?.kind === "external"}>
                                <span class="tag tag-external">
                                    External <Arrow direction="external" />
                                </span>
                            </Show>
                            <time dateTime={new Date(event()!.startsAt).toISOString()}>
                                {eventTime(event())}
                            </time>
                            <EventTags
                                series={event()!.series ?? undefined}
                                topics={event()!.topics}
                            />
                            <EventCounts
                                confirmed={
                                    event()!.registration.kind === "native" ||
                                    event()!.rsvpCount > 0
                                        ? event()!.rsvpCount
                                        : undefined
                                }
                                waitlist={event()!.waitlistCount}
                            />
                        </ItemHeader>

                        {/* content */}
                        <div class="event-layout">
                            {/* main column */}
                            <div class="event-content">
                                <ConfirmationNotice event={event()!} />

                                <Show
                                    when={event()?.description?.trim() !== event()?.summary?.trim()}
                                >
                                    <Description event={event()} />
                                </Show>
                                <Show when={(event()?.agenda.length ?? 0) > 0}>
                                    <Agenda event={event()} />
                                </Show>
                                <Show
                                    when={
                                        event()?.registration?.kind === "native" &&
                                        isRegistrationLoading()
                                    }
                                >
                                    <Card title="Registration">
                                        <p role="status">Loading…</p>
                                    </Card>
                                </Show>
                                <Show when={!isRegistrationLoading() && hasRegistration()}>
                                    <Card title="Registration">
                                        <p>
                                            <strong>
                                                {currentRegistration() &&
                                                    (event()?.status === "cancelled"
                                                        ? "Event cancelled"
                                                        : {
                                                              going: isTentative(event()!)
                                                                  ? "Registered · Event tentative"
                                                                  : "Confirmed",
                                                              pending: "Pending approval",
                                                              waitlist: "Waitlisted",
                                                              declined: "Declined",
                                                              cancelled: "Cancelled",
                                                          }[currentRegistration()!.status])}
                                            </strong>
                                        </p>
                                        <Show when={currentRegistration()?.token}>
                                            <a
                                                class="button"
                                                href={`/registration?token=${encodeURIComponent(currentRegistration()!.token!)}`}
                                            >
                                                {event()!.startsAt < Date.now() &&
                                                (event()!.feedback?.isEventEnabled ||
                                                    event()!.feedback?.isSpeakerEnabled)
                                                    ? "Give feedback"
                                                    : event()!.checkIn?.isEnabled &&
                                                        currentRegistration()?.status === "going"
                                                      ? "View pass"
                                                      : "Manage registration"}
                                            </a>
                                        </Show>
                                    </Card>
                                </Show>
                                <Show when={registration.error}>
                                    <Card title="Registration">
                                        <p class="form-error">
                                            {errorMessage(
                                                registration.error,
                                                "Could not load your registration.",
                                            )}
                                        </p>
                                        <button
                                            class="button"
                                            onClick={() => refreshRegistration()}
                                        >
                                            Retry
                                        </button>
                                    </Card>
                                </Show>
                                <Show
                                    when={
                                        event()?.registration?.kind === "native" &&
                                        event()?.status === "scheduled" &&
                                        event()!.startsAt > Date.now() &&
                                        !hasRegistration() &&
                                        !isRegistrationLoading() &&
                                        !registration.error &&
                                        !isRsvpOpen(event())
                                    }
                                >
                                    <Card title="Registration">
                                        <p>{registrationNotice(event())}</p>
                                    </Card>
                                </Show>
                                <Show
                                    when={
                                        isRsvpOpen(event()) &&
                                        !hasRegistration() &&
                                        !registration.error
                                    }
                                >
                                    <RsvpForm
                                        isSignedIn={!!account.user()}
                                        isLoadingAccount={
                                            account.isPending() || registration.loading
                                        }
                                        error={rsvpError()}
                                        event={event()}
                                        isPending={isRsvpPending()}
                                        onSubmit={submitRsvp}
                                        success={rsvpSuccess()}
                                    />
                                </Show>
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
                            </div>

                            {/* side column */}
                            <aside class="event-aside">
                                <Show when={(event()?.speakers.length ?? 0) > 0}>
                                    <Speakers event={event()} />
                                </Show>
                                <Details event={event()} />
                                <Share
                                    title={title()}
                                    url={`${site.url}/events/${encodeURIComponent(slug())}`}
                                />
                                <Show
                                    when={
                                        event()!.startsAt > Date.now() &&
                                        event()?.status !== "cancelled"
                                    }
                                >
                                    <a
                                        class="button"
                                        href={`/calendar/${slug()}`}
                                        download={`${slug()}.ics`}
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
        <Card title="Photos" id="photos">
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
    isSignedIn: boolean;
    isLoadingAccount: boolean;
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
                    : props.event?.registration?.kind === "native" && props.event.isFull
                      ? "Join the waitlist"
                      : "Register"
            }
        >
            <form class="grid gap-4" onSubmit={props.onSubmit}>
                <Show when={!props.isSignedIn && !props.isLoadingAccount}>
                    <Field label="Name">
                        <Input maxlength="120" name="name" placeholder="Your name" required />
                    </Field>

                    <Field label="Email">
                        <Input name="email" placeholder="you@example.com" required type="email" />
                    </Field>
                </Show>
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
                <Show when={!props.isSignedIn && !props.isLoadingAccount}>
                    <p class="text-sm text-soft">We’ll email you a confirmation link.</p>
                </Show>
                <Button
                    disabled={props.isPending || props.isLoadingAccount || !!props.success}
                    type="submit"
                >
                    {props.isPending
                        ? "Registering…"
                        : props.isSignedIn
                          ? props.event?.registration.kind === "native" &&
                            props.event.registration.admission === "approval"
                              ? "Apply to attend"
                              : "Register"
                          : "Continue by email"}
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
        <Card
            title="Speakers"
            toolbar={
                <a class="button" href="/contribute#speakers">
                    Suggest a speaker
                </a>
            }
        >
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
                            <p class="speaker-name">
                                <Show when={speaker.profileUrl} fallback={speaker.name}>
                                    <a href={speaker.profileUrl}>{speaker.name}</a>
                                </Show>
                            </p>

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
        (!isTentative(event) || event.confirmation!.decidesAt > Date.now()) &&
        (event.registration.overflow !== "closed" || !event.isFull) &&
        (event.registration.closesAt === undefined || event.registration.closesAt > Date.now())
    );
}

/** Explain why a future native event cannot accept another registration. */
function registrationNotice(event: PublicEvent | null | undefined): string {
    const policy = event?.registration;
    if (event && isTentative(event) && event.confirmation!.decidesAt <= Date.now())
        return "Event decision pending.";

    return policy?.kind === "native" &&
        policy.closesAt !== undefined &&
        policy.closesAt <= Date.now()
        ? "Registration is closed."
        : "This event is full.";
}
