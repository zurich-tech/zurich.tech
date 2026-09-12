import { useAccount } from "../auth";
import { createResource, Show } from "solid-js";
import { memberClient } from "../auth/convex";
import { api } from "../../convex/_generated/api";

/** Link speakers to the private feedback on their own appearances. */
export function Speaking() {
    const account = useAccount();
    const [isSpeaker] = createResource(
        () => account.user()?.id,
        async () => (await memberClient()).query(api.events.speakers.current, {}),
    );
    return (
        <Show when={isSpeaker()}>
            <a class="button" href="/feedback">
                Speaker feedback
            </a>
        </Show>
    );
}
