import { createResource, createSignal, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { memberClient } from "../auth/convex";
import { FilterSelect } from "../components/filter-select";
import { errorMessage } from "../components/errors";

/** Review an explicit invitation audience before creating a private email draft. */
export function Invitations(props: {
    /** Restrict the picker to the current event when embedded in its editor. */
    eventId?: Id<"events">;
    /** Open the prepared draft in the shared campaign review. */
    onPrepared: (id: Id<"campaigns">) => Promise<void>;
}) {
    // keep all unfinished choices local to this editor
    const [eventId, setEventId] = createSignal<string>(props.eventId ?? "");
    const [intent, setIntent] = createSignal("");
    const [isPreparing, setPreparing] = createSignal(false);
    const [error, setError] = createSignal<string>();
    const [events] = createResource(async () =>
        (await memberClient()).query(api.mail.campaigns.announcements, {}),
    );
    const event = () => events()?.find((row) => row.id === eventId());
    const [preview, { refetch }] = createResource(
        () =>
            event() && intent()
                ? { eventId: event()!.id, isFollowup: intent() === "followup" }
                : undefined,
        async (args) => (await memberClient()).query(api.mail.campaigns.invitationPreview, args),
    );
    const review = () => (preview.state === "ready" ? preview.latest : undefined);

    /** Save only a draft; scheduling remains a separate reviewed action. */
    async function prepare() {
        const selected = event();
        const isFollowup = intent() === "followup";
        if (!selected || !intent()) return;
        setPreparing(true);
        setError(undefined);
        try {
            const id = await (
                await memberClient()
            ).mutation(api.mail.campaigns.announcement, {
                eventId: selected.id,
                audience: {
                    kind: "subscribers",
                    excludeEventId: selected.id,
                    seriesId: isFollowup ? selected.seriesId : undefined,
                    invitation: isFollowup ? "followup" : undefined,
                },
            });
            await props.onPrepared(id);
        } catch (caught) {
            setError(errorMessage(caught, "Could not prepare invitation."));
        } finally {
            setPreparing(false);
        }
    }

    return (
        <section class="mail-section mail-invitation" aria-label="Event invitation">
            <h3>Invite people</h3>
            {/* use the same searchable controls as the event and map catalogues */}
            <div class="mail-audience-controls">
                <Show when={!props.eventId}>
                    <FilterSelect
                        label="Event"
                        value={eventId()}
                        onChange={(value) => {
                            setEventId(value);
                            setIntent("");
                        }}
                        options={[
                            { value: "", label: "Choose an event" },
                            ...(events() ?? []).map((row) => ({ value: row.id, label: row.title })),
                        ]}
                    />
                </Show>
                <FilterSelect
                    label="Invitation"
                    value={intent()}
                    onChange={setIntent}
                    options={[
                        { value: "", label: "Choose an audience" },
                        { value: "announcement", label: "New event · Subscribers" },
                        ...(event()?.seriesId
                            ? [{ value: "followup", label: "Follow-up · Past series registrants" }]
                            : []),
                    ]}
                />
            </div>
            <Show when={intent()}>
                <div class="mail-audience-review" aria-live="polite">
                    <div>
                        <strong>
                            {intent() === "followup"
                                ? "Past series registrants"
                                : "Event announcement subscribers"}
                        </strong>
                        <p class="mail-note">
                            Current registrants and opted-out addresses excluded.
                        </p>
                        <p class="mail-note">
                            {intent() === "followup"
                                ? "Seven days between invitations. One follow-up per event."
                                : "Previous announcements excluded. Cancelled, unattempted deliveries can be reviewed again."}
                        </p>
                    </div>
                    <div class="mail-audience-count">
                        <strong>
                            {preview.loading
                                ? "…"
                                : preview.error
                                  ? "—"
                                  : (review()?.recipients.toLocaleString("en-CH") ?? "—")}
                        </strong>
                        <span>eligible recipients</span>
                        <Show when={review()}>
                            <span>{review()!.excluded.toLocaleString("en-CH")} excluded</span>
                        </Show>
                    </div>
                </div>
            </Show>
            <Show when={error() || events.error || preview.error}>
                <p class="form-error" role="alert">
                    {error() ??
                        errorMessage(
                            events.error ?? preview.error,
                            "Could not review this audience.",
                        )}
                </p>
            </Show>
            <div class="form-actions">
                <Show when={preview.error}>
                    <button class="button button--ghost" onClick={() => void refetch()}>
                        Retry audience
                    </button>
                </Show>
                <button
                    class="button"
                    disabled={
                        !intent() ||
                        !event() ||
                        preview.loading ||
                        !!preview.error ||
                        !review()?.recipients ||
                        isPreparing()
                    }
                    onClick={() => void prepare()}
                >
                    {isPreparing() ? "Preparing…" : "Review email"}
                </button>
                <span class="mail-note">Nothing sends until you approve it.</span>
            </div>
        </section>
    );
}
