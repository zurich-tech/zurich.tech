import { PhotoUpload } from "../../../events/photo-upload";
import { useAccess, EditLink } from "../../../auth/edit";
import { PageCommands } from "../../../search/actions";
import { Affiliations } from "../../../members/affiliations";
import { VenueCard, AddressNotice } from "../../../events/venue";
import { Organisers } from "../../../events/organiser";
import { useCancellation } from "../../../events/cancellation";
import { RegistrationStatus } from "../../../events/status";
import { EventBadges, EventTags } from "../../../events/tags";
import { RegistrationCounts } from "../../../events/statistics";
import { RegistrationHistory } from "../../../events/history";
import { ConfirmationNotice } from "../../../events/confirmation";
import { isTentative } from "../../../../convex/events/conditions";
import { useAccount } from "../../../auth";
import { memberClient } from "../../../auth/convex";
import { api } from "../../../../convex/_generated/api";
import { SocialLinks } from "../../../components/social";
import { Image } from "../../../components/image";
import { CalendarButton } from "../../../events/calendar-button";
import { Share } from "../../../components/share";
import { site } from "../../site";
import { timeZone, isCurrentYear } from "../../../../convex/events/time";
import { getEvent, type PublicEvent } from "../../../events/queries";

import { Card } from "../../../components/card";
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
import "../../../events/event.css";

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
    // keep authorised arrival details out of public SEO and cached route data
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

    // register signed-in members in one click when the event asks no questions
    const isQuickRsvp = () => {
        const policy = event()?.registration;
        return !!account.user() && !(policy?.kind === "native" && policy.questions.length > 0);
    };

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
                        noIndex={event()?.visibility === "unlisted"}
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
                    <Page class="event-page publication">
                        <a class="eyebrow" href="/events">
                            <Arrow direction="left" /> Events
                        </a>
                        <Card
                            title={title()}
                            heading="h1"
                            class="item-header event-overview"
                            toolbar={
                                <div class="row-actions">
                                    <a href={`/events/${params.slug}/overview`}>Overview</a>
                                    <Show
                                        when={
                                            event()?.visibility === "unlisted" &&
                                            access.canEvent(event()!.id)
                                        }
                                    >
                                        <span
                                            class="tag"
                                            title="Anyone with the link can view this event"
                                        >
                                            Unlisted
                                        </span>
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
                                    <EditLink
                                        href={`/email?event=${event()!.id}`}
                                        eventId={event()!.id}
                                        role="organiser"
                                        label="Email"
                                    />
                                    <EditLink eventId={event()!.id} />
                                </div>
                            }
                        >
                            <div class="event-overview__body">
                                <div class="event-overview__main">
                                    {/* date, time and place */}
                                    <EventMeta event={visibleEvent()!} />

                                    {/* what the event is about */}
                                    <div class="event-overview__copy">
                                        <Show when={event()?.summary}>
                                            <p class="event-overview__summary">
                                                {event()!.summary}
                                            </p>
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
                                            />
                                        </EventTags>
                                    </div>

                                    <Show when={privateVenue.error}>
                                        <FormMessage error="Could not load your private venue details. Please reload the page." />
                                    </Show>
                                    <FormMessage error={cancellation.error()} />
                                </div>

                                {/* everything about attending in one panel beside the copy */}
                                <div class="event-ticket">
                                    <div
                                        class="event-actions"
                                        id={
                                            isQuickRsvp() ||
                                            hasRegistration() ||
                                            !isRsvpOpen(event())
                                                ? "register"
                                                : undefined
                                        }
                                    >
                                        <Switch>
                                            <Match
                                                when={
                                                    event()?.registration?.kind === "native" &&
                                                    isRegistrationLoading()
                                                }
                                            >
                                                <p role="status">Loading…</p>
                                            </Match>
                                            <Match when={registration.error}>
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
                                            </Match>
                                            <Match when={hasRegistration()}>
                                                <a
                                                    class="registration-status-link"
                                                    href={registrationHref()}
                                                    title="View your registration"
                                                >
                                                    <RegistrationStatus
                                                        status={currentRegistration()!.status}
                                                        isCancelled={
                                                            event()?.status === "cancelled"
                                                        }
                                                        isTentative={isTentative(event()!)}
                                                    />
                                                </a>
                                                <Show
                                                    when={
                                                        event()!.checkIn?.isEnabled &&
                                                        currentRegistration()?.status === "going" &&
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
                                                            event()!.feedback?.isSpeakerEnabled) &&
                                                        currentRegistration()?.status === "going" &&
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
                                                        currentRegistration()?.status !== "declined"
                                                    }
                                                >
                                                    <button
                                                        class="button"
                                                        disabled={cancellation.isPending()}
                                                        onClick={() => void cancellation.cancel()}
                                                    >
                                                        {cancellation.isPending()
                                                            ? "Cancelling…"
                                                            : "Cancel"}
                                                    </button>
                                                </Show>
                                            </Match>
                                            <Match when={isRsvpOpen(event()) && isQuickRsvp()}>
                                                <form
                                                    class="event-actions__form"
                                                    onSubmit={submitRsvp}
                                                >
                                                    <Button
                                                        type="submit"
                                                        disabled={
                                                            isRsvpPending() || !!rsvpSuccess()
                                                        }
                                                    >
                                                        {isRsvpPending()
                                                            ? "Registering…"
                                                            : registrationTitle(event())}
                                                    </Button>
                                                </form>
                                            </Match>
                                            <Match when={isRsvpOpen(event())}>
                                                <a class="button button--primary" href="#register">
                                                    {registrationTitle(event())}
                                                </a>
                                            </Match>
                                            <Match
                                                when={
                                                    event()?.registration?.kind === "external" &&
                                                    event()?.status !== "cancelled" &&
                                                    (event()?.startsAt ?? 0) > Date.now()
                                                }
                                            >
                                                <a
                                                    class="button button--primary"
                                                    href={
                                                        (event()?.registration as { url: string })
                                                            .url
                                                    }
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    Register on{" "}
                                                    {registrationSite(
                                                        (event()!.registration as { url: string })
                                                            .url,
                                                    )}{" "}
                                                    <Arrow direction="external" />
                                                </a>
                                            </Match>
                                            <Match
                                                when={
                                                    event()?.registration?.kind === "native" &&
                                                    event()?.status === "scheduled" &&
                                                    event()!.startsAt > Date.now()
                                                }
                                            >
                                                <p>{registrationNotice(event())}</p>
                                            </Match>
                                            <Match
                                                when={
                                                    event()?.registration?.kind === "none" &&
                                                    event()?.status === "scheduled" &&
                                                    (event()?.startsAt ?? 0) > Date.now()
                                                }
                                            >
                                                <p>No registration required.</p>
                                            </Match>
                                        </Switch>
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
                                    </div>
                                    <RegistrationCounts
                                        event={event()!}
                                        isOrganiser={access.canEvent(event()!.id, "organiser")}
                                    />
                                    <Show
                                        when={
                                            event()!.registration.kind === "native" &&
                                            access.canEvent(event()!.id, "organiser")
                                        }
                                    >
                                        <RegistrationHistory eventId={event()!.id} />
                                    </Show>
                                    <Show
                                        when={
                                            isRsvpOpen(event()) &&
                                            isQuickRsvp() &&
                                            !hasRegistration()
                                        }
                                    >
                                        <p class="event-actions__note">
                                            Registration includes community emails and event
                                            updates. You can unsubscribe anytime.
                                        </p>
                                    </Show>
                                    <Show when={isQuickRsvp()}>
                                        <FormMessage error={rsvpError()} success={rsvpSuccess()} />
                                    </Show>
                                </div>
                            </div>
                        </Card>

                        {/* content */}
                        <div class="detail-layout">
                            {/* main column */}
                            <div class="detail-content">
                                <ConfirmationNotice event={event()!} />

                                <Show when={(event()?.speakers.length ?? 0) > 0}>
                                    <Speakers event={event()} />
                                </Show>
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
                                        !isQuickRsvp() &&
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
                            <aside class="detail-aside">
                                <VenueCard venue={visibleEvent()!.venue} />
                                <Share
                                    title={title()}
                                    url={`${site.url}/events/${encodeURIComponent(slug())}`}
                                />
                                <Show when={event()!.organiser || event()!.coOrganisers?.length}>
                                    <Card
                                        title={
                                            event()!.coOrganisers?.length
                                                ? "Organisers"
                                                : "Organiser"
                                        }
                                    >
                                        <Organisers
                                            detailed
                                            primary={event()!.organiser}
                                            others={event()!.coOrganisers}
                                        />
                                    </Card>
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
                        <Show
                            when={
                                (event()?.media.length ?? 0) > 0 ||
                                ((access.current()?.isTeam ||
                                    access.canEvent(event()?.id, "organiser")) &&
                                    event()!.startsAt < Date.now())
                            }
                        >
                            <Photos event={event()} />
                        </Show>

                        {/* keep registration one tap away while reading on a phone */}
                        <Show
                            when={
                                isRsvpOpen(event()) &&
                                !isRegistrationLoading() &&
                                !hasRegistration() &&
                                !registration.error
                            }
                        >
                            <div class="event-register-bar">
                                <span>
                                    <strong>{title()}</strong>
                                    <span>{eventDate(event()!.startsAt)}</span>
                                </span>
                                <Show
                                    when={isQuickRsvp()}
                                    fallback={
                                        <a class="button button--primary" href="#register">
                                            {registrationTitle(event())}
                                        </a>
                                    }
                                >
                                    <form class="event-actions__form" onSubmit={submitRsvp}>
                                        <Button type="submit" disabled={isRsvpPending()}>
                                            {isRsvpPending()
                                                ? "Registering…"
                                                : registrationTitle(event())}
                                        </Button>
                                    </form>
                                </Show>
                            </div>
                        </Show>
                    </Page>
                </>
            </Match>
        </Switch>
    );
}

/** Event photos. */
function Photos(props: { event: PublicEvent | null | undefined }) {
    const access = useAccess();
    const canManage = () =>
        !!access.current()?.isTeam || access.canEvent(props.event?.id, "organiser");
    const [photoError, setPhotoError] = createSignal<string>();
    const [isRemoving, setIsRemoving] = createSignal(false);
    /** Confirm and remove the selected event photo. */
    async function removePhoto() {
        const current = image();
        if (!current || !window.confirm("Remove this photo from the event?")) return;
        setIsRemoving(true);
        setPhotoError(undefined);
        try {
            await (await memberClient()).mutation(api.events.photos.remove, { id: current.id });
            close();
            setPosition(0);
            await revalidate(getEvent.keyFor(props.event!.slug));
        } catch (caught) {
            setPhotoError(errorMessage(caught, "Could not remove this photo."));
        } finally {
            setIsRemoving(false);
        }
    }
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
            <Show when={canManage() && props.event}>
                <PhotoUpload
                    eventId={props.event!.id}
                    saved={async () => {
                        await revalidate(getEvent.keyFor(props.event!.slug));
                    }}
                />
            </Show>
            <FormMessage error={photoError()} />
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
                    <Show when={canManage()}>
                        <button
                            type="button"
                            class="action-link"
                            disabled={isRemoving()}
                            onClick={removePhoto}
                        >
                            Remove photo
                        </button>
                    </Show>
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
            <ol class="agenda">
                <For each={props.event?.agenda ?? []}>
                    {(item) => (
                        <li>
                            <time>{item.time}</time>
                            <span>
                                {item.title}
                                <Show when={item.speakerIds.length}>
                                    <small class="text-soft" style={{ display: "block" }}>
                                        {item.speakerIds
                                            .map((id) => {
                                                const speaker = props.event!.speakers.find(
                                                    (speaker) => speaker.id === id,
                                                );
                                                if (!speaker)
                                                    throw new Error("programme speaker is missing");

                                                return speaker.name;
                                            })
                                            .join(", ")}
                                    </small>
                                </Show>
                            </span>
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
            <form class="editor" onSubmit={props.onSubmit}>
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
                    <p>We’ll email you a confirmation link.</p>
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
                <p>
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
        <Card title="Speakers" id="speakers">
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

/** Show when and where the event happens, led by a large date. */
function EventMeta(props: { event: PublicEvent }) {
    const part = (options: Intl.DateTimeFormatOptions) =>
        new Date(props.event.startsAt).toLocaleDateString("en-GB", { ...options, timeZone });

    return (
        <div class="event-when">
            <time class="event-when__date" dateTime={new Date(props.event.startsAt).toISOString()}>
                <span class="event-when__day">{part({ day: "numeric" })}</span>
                <span class="event-when__month">{part({ month: "short" })}</span>
            </time>
            <div class="event-when__details">
                <strong>{eventDate(props.event.startsAt)}</strong>
                <span>{eventTime(props.event)} Zurich time</span>
                <a href="#venue">
                    {props.event.venue.name || props.event.venue.address || "Venue to be announced"}
                </a>
                <AddressNotice venue={props.event.venue} />
            </div>
        </div>
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
