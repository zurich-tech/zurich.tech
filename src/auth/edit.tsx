import { useNavigate } from "@solidjs/router";
import { createContext, useContext, createResource, createSignal, Show, type JSX } from "solid-js";
import { useAccount } from "./index";
import { memberClient } from "./convex";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { errorMessage } from "../components/errors";

/** Share team permissions across the current page without sharing private state between sessions. */
function createAccess() {
    const account = useAccount();
    const [access, { refetch }] = createResource(
        () => account.user()?.id,
        async (accountId) => ({
            accountId,
            ...(await (await memberClient()).query(api.auth.queries.current, {})),
        }),
        { initialValue: null },
    );
    return { account, access, refetch };
}

const TeamContext = createContext<ReturnType<typeof createAccess>>();

/** Own one permission request for all contextual editor controls. */
export function TeamProvider(props: { children: JSX.Element }) {
    const access = createAccess();
    return <TeamContext.Provider value={access}>{props.children}</TeamContext.Provider>;
}

/** Expose the matching editor to authenticated team members. */
export function TeamEdit(
    props: ({ eventId: Id<"events">; href?: never } | { href: string; eventId?: never }) & {
        label?: string;
    },
) {
    const navigate = useNavigate();
    const context = useContext(TeamContext);
    if (!context) throw new Error("TeamProvider is required.");
    const { account, access, refetch } = context;
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
            navigate(`/submit?edit=${id}`);
        } catch (caught) {
            setError(errorMessage(caught, "Could not open the editor."));
            setIsPending(false);
        }
    }

    return (
        <Show when={account.user()}>
            <Show when={access.error}>
                <button
                    class="button"
                    title="Could not load editing permissions"
                    onClick={() => void refetch()}
                >
                    Retry access
                </button>
            </Show>
            <Show
                when={
                    !access.error &&
                    access.latest?.accountId === account.user()?.id &&
                    access.latest?.isTeam
                }
            >
                <div class="team-edit">
                    <Show
                        when={props.href}
                        fallback={
                            <button class="button" disabled={isPending()} onClick={edit}>
                                {isPending() ? "Opening…" : (props.label ?? "Edit")}
                            </button>
                        }
                    >
                        <a class="button" href={props.href}>
                            {props.label ?? "Edit"}
                        </a>
                    </Show>
                    <Show when={error()}>
                        <p class="form-error" role="alert">
                            {error()}
                        </p>
                    </Show>
                </div>
            </Show>
        </Show>
    );
}
