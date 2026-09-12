import { Rating } from "../components/rating";
import { useAccount } from "../auth";
import "./participation.css";
import { createResource, createSignal, For, Show } from "solid-js";
import { Card } from "../components/card";
import { api } from "../../convex/_generated/api";
import { memberClient, publicClient } from "../auth/convex";
import type { Id } from "../../convex/_generated/dataModel";
import { errorMessage } from "../components/errors";

/** Collect private event and speaker responses through a registration link. */
export function FeedbackForm(props: { token: string }) {
    const [form] = createResource(
        () => props.token,
        (token) => publicClient().query(api.events.feedback.form, { token }),
    );
    return (
        <Show when={form()?.isOpen && (form()?.isEventEnabled || form()?.speakers.length)}>
            <div id="feedback">
                <Card title="Feedback">
                    <Show when={form()?.isEventEnabled}>
                        <Response
                            token={props.token}
                            title="Event"
                            initial={form()?.responses.find((row) => !row.speakerId)}
                        />
                    </Show>
                    <For each={form()?.speakers}>
                        {(speaker) => (
                            <Response
                                token={props.token}
                                speakerId={speaker.id}
                                title={speaker.name}
                                initial={form()?.responses.find(
                                    (row) => row.speakerId === speaker.id,
                                )}
                            />
                        )}
                    </For>
                </Card>
            </div>
        </Show>
    );
}

/** Save one response without replacing other feedback or resetting the page. */
function Response(props: {
    token: string;
    title: string;
    speakerId?: Id<"speakers">;
    initial?: { rating?: number; comment?: string };
}) {
    const [rating, setRating] = createSignal(props.initial?.rating);
    const [comment, setComment] = createSignal(props.initial?.comment ?? "");
    const [message, setMessage] = createSignal("");
    const [pending, setPending] = createSignal(false);
    async function save(event: SubmitEvent) {
        event.preventDefault();
        setPending(true);
        setMessage("");
        try {
            await publicClient().mutation(api.events.feedback.save, {
                token: props.token,
                speakerId: props.speakerId,
                rating: rating(),
                comment: comment(),
            });
            setMessage("Saved");
        } catch (error) {
            setMessage(errorMessage(error, "Could not save feedback."));
        } finally {
            setPending(false);
        }
    }
    return (
        <form class="feedback-response" onSubmit={save}>
            <h3>{props.title}</h3>
            <Rating
                value={rating()}
                onChange={setRating}
                label={`Rating for ${props.title}`}
                disabled={pending()}
            />
            <label>
                Comment
                <textarea
                    rows="3"
                    maxlength="4000"
                    value={comment()}
                    onInput={(event) => setComment(event.currentTarget.value)}
                />
            </label>
            <div class="form-actions">
                <button
                    class="button button--primary"
                    disabled={pending() || (!rating() && !comment().trim())}
                >
                    Save feedback
                </button>
                <span role="status">{message()}</span>
            </div>
        </form>
    );
}

/** Show feedback to the team or only the signed-in speaker's appearances. */
export function ReceivedFeedback(props: { eventId?: Id<"events"> }) {
    const account = useAccount();
    const [rows] = createResource(
        () => (account.user()?.id ? (props.eventId ?? "self") : undefined),
        async () =>
            (await memberClient()).query(api.events.feedback.received, { eventId: props.eventId }),
    );
    return (
        <Card title="Feedback">
            <Show when={!account.isPending() && !account.user()}>
                <a class="button" href="/sign-in">
                    Sign in
                </a>
            </Show>
            <Show when={rows.error}>
                <p role="alert">{errorMessage(rows.error, "Could not load feedback.")}</p>
            </Show>
            <Show when={rows.loading}>
                <p role="status">Loading…</p>
            </Show>
            <Show
                when={rows()?.length}
                fallback={
                    <Show when={!rows.loading && !rows.error}>
                        <p class="text-soft">No feedback yet</p>
                    </Show>
                }
            >
                <For each={rows()}>
                    {(row) => (
                        <article class="feedback-response">
                            <h3>{row.speaker ?? row.event}</h3>
                            <Show when={row.speaker}>
                                <p class="text-soft">{row.event}</p>
                            </Show>
                            <Show when={row.rating}>
                                <Rating value={row.rating} />
                            </Show>
                            <Show when={row.comment}>
                                <p style={{ "white-space": "pre-wrap" }}>{row.comment}</p>
                            </Show>
                        </article>
                    )}
                </For>
            </Show>
        </Card>
    );
}
