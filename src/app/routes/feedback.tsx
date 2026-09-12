import { useSearchParams } from "@solidjs/router";
import { Page } from "../page";
import { Seo } from "../seo";
import { ReceivedFeedback } from "../../events/feedback";
import type { Id } from "../../../convex/_generated/dataModel";
import "../../events/participation.css";

/** Review private feedback for an event or the signed-in speaker. */
export default function Route() {
    const [params] = useSearchParams();
    return (
        <>
            <Seo title="Feedback" description="Private event feedback." />
            <Page>
                <ReceivedFeedback
                    eventId={
                        typeof params.event === "string"
                            ? (params.event as Id<"events">)
                            : undefined
                    }
                />
            </Page>
        </>
    );
}
