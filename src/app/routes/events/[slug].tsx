import { useAccess } from "../../../auth/edit";
import { PageCommands } from "../../../search/actions";
import { Affiliations } from "../../../members/affiliations";
import { VenueCard, AddressNotice } from "../../../events/venue";
import { Organisers } from "../../../events/organiser";
import { useCancellation } from "../../../events/cancellation";
import { RegistrationStatus } from "../../../events/status";
import { EventBadges, EventTags } from "../../../events/tags";
import { RegistrationStatistics } from "../../../events/statistics";
import { ConfirmationNotice } from "../../../events/confirmation";
import { isTentative } from "../../../../convex/events/conditions";
import { useAccount } from "../../../auth";
import { memberClient } from "../../../auth/convex";
import { api } from "../../../../convex/_generated/api";
import { EditLink } from "../../../auth/edit";
import { SocialLinks } from "../../../components/social";
import { Image } from "../../../components/image";
import { CalendarButton } from "../../../events/calendar-button";
import { Share } from "../../../components/share";
import { site, timeZone } from "../../site";
import { getEvent, type PublicEvent } from "../../../events/queries";

import { Card } from "../../../components/card";
import { isCurrentYear } from "../../../events/time";
import { Arrow } from "../../../components/arrow";
import { useParams, revalidate } from "@solidjs/router";
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
import { Page } from "../../page";
import { Seo } from "../../seo";
import { rsvp, registrationSite } from "../../../events/registration";

import { errorMessage } from "../../../components/errors";
import { routeParam } from "../../params";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: ({ params }: { params: Record<string, string> }) => getEvent(params.slug),
};

/** Event detail page. */
export default function Route() {
    const account = useAccount();
    const access = useAccess();
    // params
    const params = useParams();
    const slug = () => routeParam("slug", params.slug);

    // event
    const event = getEvent.use(() => [slug()]);
    const title = () => event()?.title ?? slug();

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
    // Keep authorised arrival details out of public SEO and cached route data.
    const [privateVenue, { refetch: refreshVenue }] = createResource(
        () =>
            account.user() && event()?.venue.availability === "confirmed"
                ? `${account.user()!.id}:${event()!.id}:${currentRegistration()?.status ?? ""}`
                : undefined,
        async (key) => ({
            key,
            venue: await (
                await memberClient()
            ).query(api.events.place.get, { eventId: event()!.id }),
        }),
    );
    const visibleEvent = () => {
        const published = event();
        const key =
            account.user() && published
                ? `${account.user()!.id}:${published.id}:${currentRegistration()?.status ?? ""}`
                : undefined;
        const venue =
            !privateVenue.error && !privateVenue.loading && privateVenue.latest?.key === key
                ? privateVenue.latest?.venue
                : undefined;
        return published ? { ...published, venue: venue ?? published.venue } : undefined;
    };
    const hasRegistration = () =>
        !!currentRegistration() && currentRegistration()?.status !== "cancelled";

    const cancellation = useCancellation(
        () => currentRegistration()?.token ?? "",
        () => Promise.all([refreshRegistration(), revalidate(getEvent.key)]),
    );
    const registrationHref = () =>
        currentRegistration()?.token
            ? `/registration?token=${encodeURIComponent(currentRegistration()!.token!)}`
            : undefined;

    // refresh after returning from the registration management page
    onMount(() => {
        const refresh = () => {
            if (account.user())
                void startTransition(async () => {
                    await refreshRegistration();
                    if (event()?.venue.availability === "confirmed") await refreshVenue();
                });
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
                    <PageCommands
                        items={[
                            ...(access.canEvent(event()!.id)
                                ? [
                                      {
                                          id: "edit-current-event",
                                          label: "Edit this event",
                                          href: `/submit?event=${event()!.id}`,
                                          group: "This event",
                                      },
                                  ]
                                : []),
                            ...(registrationHref()
                                ? [
                                      {
                                          id: "registration",
                                          label: "View registration",
                                          href: registrationHref()!,
                                          group: "This event",
                                      },
                                  ]
                                : []),
                            ...(hasRegistration() &&
                            currentRegistration()?.status === "going" &&
                            event()!.startsAt > Date.now() &&
                            event()!.status !== "cancelled"
                                ? [
                                      {
                                          id: "cancel-registration",
                                          label: "Cancel registration",
                                          description: "Review before cancelling",
                                          group: "This event",
                                          run: () => cancellation.cancel(),
                                      },
                                  ]
                                : []),
                        ]}
                    />
                    <Page class="event-page">
                        <a class="eyebrow" href="/events">
                            <Arrow direction="left" /> Events
                        </a>
                        <Card
                            title={title()}
                            heading="h1"
                            class="item-header event-overview"
                            toolbar={
                                <div class="row-actions">
                                    <Show when={!isRegistrationLoading() && hasRegistration()}>
                                        <div
                                            class="event-overview__account"
                                            aria-label="Your registration"
                                        >
                                            <div class="registration-actions">
                                                <a
                                                    class="registration-status-link"
                                                    href={registrationHref()}
                                                    title="View your registration"
                                                >
                                                    {" "}
                                                    <RegistrationStatus
                                                        status={currentRegistration()!.status}
                                                        isCancelled={
                                                            event()?.status === "cancelled"
                                                        }
                                                        isTentative={isTentative(event()!)}
                                                    />
                                                </a>
                                                <div class="registration-actions__buttons">
                                                    <Show
                                                        when={
                                                            event()!.checkIn?.isEnabled &&
                                                            currentRegistration()?.status ===
                                                                "going" &&
                                                            event()?.status !== "cancelled"
                                                        }
                                                    >
                                                        <a class="button" href={registrationHref()}>
                                                            View pass
                                                        </a>
                                                    </Show>
                                                    <Show
                                                        when={
                                                            event()!.startsAt < Date.now() &&
                                                            (event()!.feedback?.isEventEnabled ||
                                                                event()!.feedback
                                                                    ?.isSpeakerEnabled) &&
                                                            currentRegistration()?.status ===
                                                                "going" &&
                                                            event()?.status !== "cancelled"
                                                        }
                                                    >
                                                        <a class="button" href={registrationHref()}>
                                                            Give feedback
                                                        </a>
                                                    </Show>
                                                    <Show
                                                        when={
                                                            currentRegistration()?.token &&
                                                            event()?.status !== "cancelled" &&
                                                            event()!.startsAt > Date.now() &&
                                                            currentRegistration()?.status !==
                                                                "declined"
                                                        }
                                                    >
                                                        <button
                                                            class="button"
                                                            disabled={cancellation.isPending()}
                                                            onClick={() =>
                                                                void cancellation.cancel()
                                                            }
                                                        >
                                                            {cancellation.isPending()
                                                                ? "Cancelling…"
                                                                : "Cancel"}
                                                        </button>
                                                    </Show>
                                                </div>
                                            </div>
                                        </div>
                                    </Show>

                                    <Show when={event()!.checkIn?.isEnabled}>
                                        <EditLink
                                            href={`/checkin?event=${event()!.id}`}
                                            eventId={event()!.id}
                                            role="organiser"
                                            label="Check in"
                                        />
                                    </Show>
                                    <Show
                                        when={
                                            event()!.feedback?.isEventEnabled ||
                                            event()!.feedback?.isSpeakerEnabled
                                        }
                                    >
                                        <EditLink
                                            href={`/feedback?event=${event()!.id}`}
                                            eventId={event()!.id}
                                            role="organiser"
                                            label="Feedback"
                                        />
                                    </Show>
                                    <EditLink eventId={event()!.id} />
                                </div>
                            }
                        >
                            <EventFacts event={visibleEvent()!} />
                            <Show when={privateVenue.error}>
                                <FormMessage error="Could not load your private venue details. Please reload the page." />
                            </Show>
                            <FormMessage error={cancellation.error()} />
                            <div class="item-description description-statistics">
                                <div class="event-overview__copy">
                                    <Show when={event()?.summary}>
                                        <p class="event-overview__summary">{event()!.summary}</p>
                                    </Show>
                                    <EventTags
                                        detailed
                                        series={event()!.series ?? undefined}
                                        topics={event()!.topics}
                                    >
                                        <EventBadges
                                            event={event()!}
                                            showPast
                                            isPartner={event()?.isPartner}
                                            registrationKind={event()?.registration.kind}
                                        />
                                    </EventTags>
                                </div>
                                <RegistrationStatistics event={event()!} />
                            </div>
                            <Show
                                when={
                                    event()?.registration?.kind === "native" &&
                                    isRegistrationLoading()
                                }
                            >
                                <div class="event-overview__registration">
                                    <p role="status">Loading…</p>
                                </div>
                            </Show>
                            <Show when={registration.error}>
                                <div class="event-overview__registration">
                                    <p class="form-error">
                                        {errorMessage(
                                            registration.error,
                                            "Could not load your registration.",
                                        )}
                                    </p>
                                    <button class="button" onClick={() => refreshRegistration()}>
                                        Retry
                                    </button>
                                </div>
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
                                <div class="event-overview__registration">
                                    <p>{registrationNotice(event())}</p>
                                </div>
                            </Show>
                            <Show
                                when={
                                    event()?.registration?.kind === "external" &&
                                    event()?.status !== "cancelled" &&
                                    (event()?.startsAt ?? 0) > Date.now()
                                }
                            >
                                <div class="event-overview__registration">
                                    {" "}
                                    <a
                                        class="button button--primary"
                                        href={(event()?.registration as { url: string }).url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Register on{" "}
                                        {registrationSite(
                                            (event()!.registration as { url: string }).url,
                                        )}{" "}
                                        <Arrow direction="external" />
                                    </a>
                                </div>
                            </Show>
                            <Show
                                when={
                                    event()?.registration?.kind === "none" &&
                                    event()?.status === "scheduled" &&
                                    (event()?.startsAt ?? 0) > Date.now()
                                }
                            >
                                <div class="event-overview__registration">
                                    <p>No registration required.</p>
                                </div>
                            </Show>

                            <Show
                                when={
                                    isRsvpOpen(event()) &&
                                    !isRegistrationLoading() &&
                                    !hasRegistration() &&
                                    !registration.error
                                }
                            >
                                <div class="event-overview__registration">
                                    <a class="button button--primary" href="#register">
                                        {registrationTitle(event())}
                                    </a>
                                </div>
                            </Show>
                        </Card>

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
                                        isRsvpOpen(event()) &&
                                        !isRegistrationLoading() &&
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
                            </div>

                            {/* side column */}
                            <aside class="event-aside">
                                <Show when={(event()?.speakers.length ?? 0) > 0}>
                                    <Speakers event={event()} />
                                </Show>
                                <VenueCard venue={visibleEvent()!.venue} />
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
                                    <CalendarButton
                                        event={{
                                            ...event()!,
                                            description: event()!.summary,
                                            location: [
                                                visibleEvent()!.venue.name,
                                                visibleEvent()!.venue.address,
                                            ]
                                                .filter(Boolean)
                                                .join(", "),
                                        }}
                                    />
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
                        class="action-link"
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
                        class="action-link"
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
                        class="action-link"
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
        <Card id="register" title={registrationTitle(props.event)}>
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
                          ? registrationTitle(props.event)
                          : "Continue by email"}
                </Button>
                <p class="text-sm text-soft">
                    Registration includes community emails and event updates. You can unsubscribe
                    anytime; existing email preferences are respected.
                </p>
                <FormMessage error={props.error} success={props.success} />
            </form>
        </Card>
    );
}

/** Event speakers. */
function Speakers(props: { event: PublicEvent | null | undefined }) {
    return (
        <Card
            title="Speakers"
            id="speakers"
            toolbar={
                <a class="action-link" href="/contribute#speakers">
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
                            <Affiliations values={speaker.affiliations} />
                            <SocialLinks name={speaker.name} profiles={speaker.links} />
                        </div>
                    )}
                </For>
            </div>
        </Card>
    );
}

/** Format an event date in Zurich. */
function eventDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: isCurrentYear(timestamp) ? undefined : "numeric",
        timeZone,
    });
}

/** Format an event's time range without losing an overnight end date. */
function eventTime(event: PublicEvent): string {
    const time = (timestamp: number) =>
        new Date(timestamp).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone,
        });
    const start = time(event.startsAt);
    if (!event.endsAt) return start;
    const endDate = eventDate(event.endsAt);
    const end =
        endDate === eventDate(event.startsAt)
            ? time(event.endsAt)
            : `${endDate}, ${time(event.endsAt)}`;

    return `${start}–${end}`;
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

/** Show practical event details before the full programme. */
function EventFacts(props: { event: PublicEvent }) {
    return (
        <>
            <dl class="event-facts">
                <div>
                    <dt>When</dt>
                    <dd>
                        <time dateTime={new Date(props.event.startsAt).toISOString()}>
                            {eventDate(props.event.startsAt)}
                        </time>
                        <span>{eventTime(props.event)}</span>
                        <span>Zurich time</span>
                    </dd>
                </div>
                <div>
                    <dt>Where</dt>
                    <dd>
                        <a href="#venue">
                            {props.event.venue.name ||
                                props.event.venue.address ||
                                "To be announced"}
                        </a>
                        <AddressNotice venue={props.event.venue} />
                        <Show when={props.event.venue.name && props.event.venue.address}>
                            <For each={addressLines(props.event.venue.address!)}>
                                {(line) => <span>{line}</span>}
                            </For>
                        </Show>
                    </dd>
                </div>
                <Show when={props.event.speakers.length}>
                    <div>
                        <dt>Speakers</dt>
                        <dd>
                            <For each={props.event.speakers}>
                                {(speaker) => (
                                    <div class="speaker-credit">
                                        <Show when={speaker.imageUrl}>
                                            <Image
                                                src={speaker.imageUrl!}
                                                darkSrc={speaker.imageDarkUrl}
                                                alt=""
                                                width={24}
                                                height={24}
                                                loading="lazy"
                                            />
                                        </Show>
                                        <div>
                                            <a href={speaker.profileUrl || "#speakers"}>
                                                {speaker.name}
                                            </a>
                                            <Affiliations values={speaker.affiliations} />
                                        </div>
                                    </div>
                                )}
                            </For>
                        </dd>
                    </div>
                </Show>
                <Show when={props.event.organiser || props.event.coOrganisers?.length}>
                    <div>
                        <dt>{props.event.coOrganisers?.length ? "Organisers" : "Organiser"}</dt>
                        <dd>
                            <Organisers
                                detailed
                                primary={props.event.organiser}
                                others={props.event.coOrganisers}
                            />
                        </dd>
                    </div>
                </Show>
            </dl>
        </>
    );
}

/** Name the admission action consistently in the overview and form. */
function registrationTitle(event: PublicEvent | null | undefined) {
    return event?.registration.kind === "native" && event.registration.admission === "approval"
        ? "Apply to attend"
        : event?.isFull
          ? "Join the waitlist"
          : "Register";
}

/** Separate the street address from its postal locality when present. */
function addressLines(address: string): string[] {
    const parts = address.trim().match(/^(.*?),?\s+(\d{4,5})\s*,?\s+(.+)$/);

    return parts ? [parts[1].replace(/,$/, ""), `${parts[2]} ${parts[3]}`] : [address];
}
