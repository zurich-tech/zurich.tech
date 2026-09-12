import { createResource, createSignal, Show, Suspense } from "solid-js";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { useConfirmation } from "../components/dialog";
import { errorMessage } from "../components/errors";

/** Delete unused editor records with a shared confirmation and blocking reason. */
export function DeleteRecord(props: {
    id: Id<"submissions"> | Id<"series"> | Id<"schedules">;
    name: string;
    onDeleted: () => void | Promise<void>;
}) {
    const confirm = useConfirmation();
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);
    const [reason] = createResource(
        () => props.id,
        async (id) => (await memberClient()).query(api.events.deletions.reason, { id }),
    );

    /** Recheck eligibility in the mutation after explicit confirmation. */
    async function remove() {
        if (
            !(await confirm({
                title: `Delete ${props.name}`,
                description: "This cannot be undone.",
                action: "Delete",
                isDestructive: true,
                emails: 0,
            }))
        )
            return;
        setIsPending(true);
        setError(undefined);
        try {
            await (await memberClient()).mutation(api.events.deletions.remove, { id: props.id });
            await props.onDeleted();
        } catch (caught) {
            setError(errorMessage(caught, "Could not delete."));
        } finally {
            setIsPending(false);
        }
    }
    return (
        <Suspense
            fallback={
                <button class="button" disabled>
                    Delete
                </button>
            }
        >
            <div>
                <button
                    type="button"
                    class="button"
                    disabled={reason.loading || !!reason.error || !!reason() || isPending()}
                    title={
                        reason.error
                            ? "Could not check deletion availability."
                            : (reason() ?? undefined)
                    }
                    aria-description={
                        reason.error
                            ? "Could not check deletion availability."
                            : (reason() ?? undefined)
                    }
                    onClick={() => void remove()}
                >
                    Delete
                </button>
                <Show when={error() || reason.error}>
                    <p role="alert">{error() || "Could not check deletion availability."}</p>
                </Show>
            </div>
        </Suspense>
    );
}
