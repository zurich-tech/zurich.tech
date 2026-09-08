import { createResource } from "solid-js";
import { api } from "../../convex/_generated/api";
import { useAccount } from "./auth";
import { memberClient } from "./convex";

/** Load the employer or team workspace under the current authenticated identity. */
export function useEmployerWorkspace() {
    const account = useAccount();
    const [workspace, { refetch }] = createResource(
        () => account.user()?.id,
        async () => await (await memberClient()).query(api.workspace.employer, {}),
    );

    return { account, workspace, refetch };
}
