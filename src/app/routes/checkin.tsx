import { Show } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { Page } from "../page";
import { Seo } from "../seo";
import { CheckIn } from "../../events/checkin";
import type { Id } from "../../../convex/_generated/dataModel";

/** Open a team's scanner for a selected event. */
export default function Route() {
    const [params] = useSearchParams();
    return (
        <>
            <Seo title="Check-in" description="Private event checkin." />
            <Page>
                <Show
                    when={typeof params.event === "string"}
                    fallback={<p>Select an event from Admin.</p>}
                >
                    <CheckIn eventId={params.event as Id<"events">} />
                </Show>
            </Page>
        </>
    );
}
