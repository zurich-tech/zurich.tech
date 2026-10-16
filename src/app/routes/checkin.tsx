import { Card } from "../../components/card";
import { Empty } from "../../components/empty";
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
            <Page class="publication">
                <Show
                    when={typeof params.event === "string"}
                    fallback={
                        <Card title="Check-in" heading="h1">
                            <Empty title="Choose an event to check people in" />
                            <a class="button" href="/admin">
                                Events
                            </a>
                        </Card>
                    }
                >
                    <CheckIn eventId={params.event as Id<"events">} />
                </Show>
            </Page>
        </>
    );
}
