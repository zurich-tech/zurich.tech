import {
    EventFields,
    VenueFields,
    ProgrammeFields,
    RegistrationFields,
} from "../../events/event-editor";
import { getDirectory } from "../../organisations/queries";
import { Arrow } from "../../components/arrow";
import { createEffect, createResource, createSignal, Show } from "solid-js";
import { createAsync, useSearchParams } from "@solidjs/router";
import type { Registration } from "../../../convex/events/fields";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { useAccount } from "../../auth/index";
import { memberClient } from "../../auth/convex";
import { Page, PageHeader } from "../page";
import { Seo } from "../seo";
import { FormMessage } from "../../components/form";
import { errorMessage } from "../../components/errors";
import { timestamp } from "../../events/time";

/** Create, duplicate, and revise an event in the organiser workspace. */
export default function Route() {
    const account = useAccount();
    const [params] = useSearchParams();
    const directory = createAsync(() => getDirectory());
    const [workspace] = createResource(
        () => account.user()?.id,
        async () => await (await memberClient()).query(api.events.workspace.events, {}),
    );
    const draft = () =>
        workspace()?.submissions.find((item) => item._id === (params.edit ?? params.duplicate));
    const [kind, setKind] = createSignal("native");
    const [questions, setQuestions] = createSignal<{ label: string; isRequired: boolean }[]>([]);
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);
    let form!: HTMLFormElement;
    createEffect(() => {
        const item = draft();
        if (item) {
            setKind(item.registration.kind);
            setQuestions(item.registration.kind === "native" ? item.registration.questions : []);
        }
    });

    /** Save one validated draft, optionally submitting or publishing it. */
    async function save(event: SubmitEvent) {
        // read the authored event fields
        event.preventDefault();
        setError(undefined);
        setSuccess(undefined);
        setIsPending(true);
        const fields = new FormData(form);
        const intent = (event.submitter as HTMLButtonElement)?.value;
        const text = (name: string) => String(fields.get(name) ?? "").trim();
        try {
            const policy: Registration =
                kind() === "external"
                    ? {
                          kind: "external",
                          url: text("url"),
                          capacity: text("capacity") ? Number(text("capacity")) : undefined,
                      }
                    : kind() === "none"
                      ? { kind: "none" }
                      : {
                            kind: "native",
                            admission: text("admission") as "automatic" | "approval",
                            capacity: text("capacity") ? Number(text("capacity")) : null,
                            overflow: text("overflow") as "waitlist" | "closed",
                            closesAt: text("closesAt") ? timestamp(text("closesAt")) : undefined,
                            questions: questions(),
                        };
            const client = await memberClient();
            const id = await client.mutation(api.events.mutations.save, {
                id: params.edit ? draft()?._id : undefined,
                submit: intent !== "draft",
                title: text("title"),
                slug: text("slug"),
                description: text("description"),
                format: text("format") as Doc<"events">["format"],
                seriesId: text("series") ? (text("series") as Id<"series">) : undefined,
                topics: text("topics")
                    .split(",")
                    .map((tag) => tag.trim().toLowerCase())
                    .filter(Boolean),
                startsAt: timestamp(text("startsAt")),
                endsAt: text("endsAt") ? timestamp(text("endsAt")) : undefined,
                location: text("location"),
                latitude: text("latitude") ? Number(text("latitude")) : undefined,
                longitude: text("longitude") ? Number(text("longitude")) : undefined,
                registration: policy,
                organisations: fields.getAll("organisations") as Id<"organisations">[],
                speakers: text("speakers")
                    .split("\n")
                    .filter(Boolean)
                    .map((line) => {
                        const [name, title = "", urls = "", image = "", imageDark = ""] =
                            line.split("|");
                        const links = urls
                            .split(",")
                            .map((url) => url.trim())
                            .filter(Boolean);

                        return {
                            name: name.trim(),
                            title: title.trim(),
                            links,
                            imageUrl: image.trim() || undefined,
                            imageDarkUrl: imageDark.trim() || undefined,
                        };
                    }),
                agenda: text("agenda")
                    .split("\n")
                    .filter(Boolean)
                    .map((line) => {
                        const [time, ...title] = line.split("|");

                        return { time: time.trim(), title: title.join("|").trim() };
                    }),
            });
            if (intent === "publish") await client.mutation(api.events.mutations.publish, { id });
            setSuccess(
                intent === "publish"
                    ? "Published. Your event is on the calendar."
                    : intent === "draft"
                      ? "Draft saved."
                      : "Submitted for team review.",
            );
            window.history.replaceState({}, "", `/submit?edit=${id}`);
            window.location.assign(`/admin?saved=${intent}`);
        } catch (caught) {
            setError(errorMessage(caught, "Could not save the event."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <Seo
                title="Submit event"
                description="Bring your talk, dinner, workshop, or hackathon to Zürich’s tech community."
            />
            <Page width="narrow">
                <PageHeader title={params.edit ? "Edit event" : "Submit an event"} />
                <Show
                    when={account.user()}
                    fallback={
                        <div class="empty-panel">
                            <h2>Sign in to submit an event</h2>
                            <p>
                                Sign in to create a draft and submit it for review. Regular
                                organisers can publish directly.
                            </p>
                            <a class="button button--primary" href="/sign-in">
                                Sign in to contribute <Arrow direction="external" />
                            </a>
                        </div>
                    }
                >
                    <Show when={workspace.error}>
                        <p role="alert" class="form-error">
                            {errorMessage(workspace.error, "Could not load your workspace.")}
                        </p>
                    </Show>
                    <Show when={workspace() && (!(params.edit || params.duplicate) || draft())}>
                        <form class="editor" ref={form} onSubmit={save}>
                            {/* describe the event and its relationship to a series */}
                            <EventFields
                                draft={draft()}
                                isDuplicate={!!params.duplicate}
                                directory={directory()}
                            />
                            {/* enter real Zürich local dates and an optional map position */}
                            <VenueFields draft={draft()} />
                            {/* compose admission, capacity, and overflow independently */}
                            <RegistrationFields
                                draft={draft()}
                                kind={kind()}
                                setKind={setKind}
                                questions={questions()}
                                setQuestions={setQuestions}
                            />
                            {/* keep programme details optional and quick to enter */}
                            <ProgrammeFields draft={draft()} directory={directory()} />
                            <Show when={draft()?.reviewNote}>
                                <p class="review-note">Team feedback: {draft()?.reviewNote}</p>
                            </Show>
                            <div class="form-actions">
                                <button
                                    class="button"
                                    type="submit"
                                    value="draft"
                                    disabled={isPending()}
                                >
                                    Save draft
                                </button>
                                <button
                                    class="button button--primary"
                                    type="submit"
                                    value={workspace()?.viewer.canPublish ? "publish" : "review"}
                                    disabled={isPending()}
                                >
                                    {isPending()
                                        ? "Saving…"
                                        : workspace()?.viewer.canPublish
                                          ? "Publish event"
                                          : "Submit for review"}
                                </button>
                            </div>
                            <FormMessage error={error()} success={success()} />
                        </form>
                    </Show>
                </Show>
            </Page>
        </>
    );
}
