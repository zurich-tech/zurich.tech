import type { FunctionReturnType } from "convex/server";
import { errorMessage } from "../components/errors";
import { createResource, createSignal } from "solid-js";
import { api } from "../../convex/_generated/api";
import { useAccount } from "../auth/index";
import { memberClient } from "../auth/convex";

/** Events and publishing permissions visible to the current account. */
export type EventWorkspace = FunctionReturnType<typeof api.events.workspace.events>;

/** The selected event and its private attendee records. */
export type AttendeeList = FunctionReturnType<typeof api.events.registrations.list>;

/** Run an authorised operation and refresh its visible records. */
export type Perform = (operation: () => Promise<unknown>, message: string) => Promise<void>;

/** Load the employer or team workspace under the current authenticated identity. */
export function useEmployerWorkspace() {
    const account = useAccount();
    const [workspace, { refetch }] = createResource(
        () => account.user()?.id,
        async () => await (await memberClient()).query(api.organisations.workspace.employer, {}),
    );

    return { account, workspace, refetch };
}

/** Track a workspace command and refresh only its owning section. */
export function useWorkspaceCommand(refresh: () => unknown) {
    const [isPending, setIsPending] = createSignal(false);
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();

    /** Run the command and retain its visible result. */
    async function perform(operation: () => Promise<unknown>, message: string) {
        // clear the previous result before attempting the command
        setIsPending(true);
        setError(undefined);
        setSuccess(undefined);

        // refresh the owning section only after a successful mutation
        try {
            await operation();
            await refresh();
            setSuccess(message);
        } catch (caught) {
            setError(errorMessage(caught, "Could not complete the action."));
        } finally {
            setIsPending(false);
        }
    }

    return { isPending, error, success, perform };
}
