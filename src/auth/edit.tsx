import { useNavigate } from "@solidjs/router";
import {
    createContext,
    useContext,
    createResource,
    createSignal,
    createMemo,
    Show,
    onMount,
    onCleanup,
    type JSX,
} from "solid-js";
import { useAccount } from "./index";
import { memberClient } from "./convex";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { errorMessage } from "../components/errors";

/** Share scoped permissions without sharing private state between sessions. */
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
    onMount(() => {
        const refresh = () => {
            if (account.user()) void refetch();
        };
        window.addEventListener("focus", refresh);
        onCleanup(() => window.removeEventListener("focus", refresh));
    });
    const current = () =>
        !access.error && access.latest?.accountId === account.user()?.id ? access.latest : null;
    const key = createMemo(() => {
        const value = current();
        return value?.canManage
            ? JSON.stringify([value.accountId, value.isAdmin, value.grants, value.editableEventIds])
            : undefined;
    });
    const canEvent = (id: string | undefined, role: "editor" | "organiser" = "editor") =>
        !!current()?.isAdmin ||
        (!!id &&
            (role === "editor"
                ? current()?.editableEventIds
                : current()?.organisedEventIds
            )?.includes(id as Id<"events">) === true);
    const canSeries = (id: string | undefined, role: "editor" | "organiser" = "editor") =>
        !!current()?.isAdmin ||
        (!!id &&
            !!current()?.grants.some(
                (grant) =>
                    grant.scope.kind === "series" &&
                    grant.scope.id === id &&
                    (role === "editor" || grant.role === "organiser"),
            ));
    const canCreate = (seriesId?: string) =>
        !!current()?.isAdmin ||
        !!current()?.grants.some(
            (grant) =>
                grant.scope.kind === "series" &&
                grant.role === "organiser" &&
                (!seriesId || grant.scope.id === seriesId),
        );
    return { account, access, current, key, canEvent, canSeries, canCreate, refetch };
}

const AccessContext = createContext<ReturnType<typeof createAccess>>();

/** Reuse the session's permissions instead of fetching them on each navigation. */
export function useAccess() {
    const context = useContext(AccessContext);
    if (!context) throw new Error("AccessProvider is required.");
    return context;
}

/** Own one permission request for all contextual editor controls. */
export function AccessProvider(props: { children: JSX.Element }) {
    const access = createAccess();
    return <AccessContext.Provider value={access}>{props.children}</AccessContext.Provider>;
}

/** Expose an edit link only for its matching permission. */
export function EditLink(
    props: {
        memberId?: Id<"members">;
        organisationId?: Id<"organisations">;
        eventId?: Id<"events">;
        seriesId?: Id<"series">;
        href?: string;
        role?: "editor" | "organiser";
    } & {
        label?: string;
    },
) {
    const navigate = useNavigate();
    const context = useAccess();
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
                    (props.memberId
                        ? context.current()?.memberId === props.memberId
                        : props.organisationId
                          ? context.current()?.isAdmin ||
                            context.current()?.ownedOrganisationIds.includes(props.organisationId)
                          : props.eventId
                            ? context.canEvent(props.eventId, props.role)
                            : props.seriesId
                              ? context.canSeries(props.seriesId, props.role)
                              : context.current()?.isAdmin)
                }
            >
                <div class="team-edit">
                    <Show
                        when={props.href}
                        fallback={
                            <button class="action-link" disabled={isPending()} onClick={edit}>
                                {isPending() ? "Opening…" : (props.label ?? "Edit")}
                            </button>
                        }
                    >
                        <a class="action-link" href={props.href}>
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
