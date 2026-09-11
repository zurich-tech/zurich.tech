import { createResource, createSignal, Show } from "solid-js";
import { useAccount } from "./index";
import { memberClient } from "./convex";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { errorMessage } from "../components/errors";

/** Expose the matching editor to authenticated team members. */
export function TeamEdit(
    props: { eventId: Id<"events">; href?: never } | { href: string; eventId?: never },
) {
    const account = useAccount();
    const [access] = createResource(
        () => account.user()?.id,
        async () => (await memberClient()).query(api.auth.queries.current, {}),
    );
    const [isPending, setIsPending] = createSignal(false);
    const [error, setError] = createSignal<string>();

    async function edit() {
        if (!props.eventId) return;
        setIsPending(true);
        setError(undefined);
        try {
            const id = await (
                await memberClient()
            ).mutation(api.events.mutations.edit, { eventId: props.eventId });
            window.location.assign(`/submit?edit=${id}`);
        } catch (caught) {
            setError(errorMessage(caught, "Could not open the editor."));
            setIsPending(false);
        }
    }

    return (
        <Show when={access()?.isTeam}>
            <div class="team-edit">
                <Show
                    when={props.href}
                    fallback={
                        <button class="button" disabled={isPending()} onClick={edit}>
                            {isPending() ? "Opening…" : "Edit"}
                        </button>
                    }
                >
                    <a class="button" href={props.href}>
                        Edit
                    </a>
                </Show>
                <Show when={error()}>
                    <p class="form-error" role="alert">
                        {error()}
                    </p>
                </Show>
            </div>
        </Show>
    );
}
