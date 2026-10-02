import { useAccount } from "../auth";
import { createResource, Show } from "solid-js";
import { memberClient } from "../auth/convex";
import { api } from "../../convex/_generated/api";
import { Card } from "../components/card";
import { Loading } from "../components/loading";

/** Link speakers to the private feedback on their own appearances. */
export function Speaking() {
    const account = useAccount();
    const [isSpeaker] = createResource(
        () => account.user()?.id,
        async () => (await memberClient()).query(api.events.speakers.current, {}),
    );
    return (
        <Card title="Speaking">
            <Show when={!isSpeaker.loading} fallback={<Loading />}>
                <Show
                    when={!isSpeaker.error}
                    fallback={<p class="form-error">Could not load your speaking activity.</p>}
                >
                    <Show
                        when={isSpeaker()}
                        fallback={
                            <p class="text-soft">
                                No speaking appearances linked to your account yet.
                            </p>
                        }
                    >
                        <a class="action-link" href="/feedback">
                            Speaker feedback
                        </a>
                    </Show>
                </Show>
            </Show>
        </Card>
    );
}
