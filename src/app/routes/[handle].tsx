import { getHandle, type PublicHandle } from "../../members/queries";
import { Card } from "../../components/card";
import { createAsync, useParams } from "@solidjs/router";
import { Match, Show, Switch } from "solid-js";

import { Button } from "../../components/button";
import { NotFound } from "../notfound";
import { Page, PageHeader } from "../page";
import { Seo } from "../seo";

/** Handle lookup. */
export default function Route() {
    // handle segment
    const params = useParams();
    const segment = params.handle ?? "";

    // reject non-handle routes
    if (!segment.startsWith("@")) {
        return <NotFound />;
    }

    return <HandleTarget handle={segment.slice(1)} />;
}

/** Handle target lookup and profile shortcut. */
function HandleTarget(props: { handle: string }) {
    // handle
    const handle = createAsync(() => getHandle(props.handle), { deferStream: true });
    const member = () => memberHandle(handle());
    const title = () => member()?.title ?? `@${props.handle}`;

    return (
        <Switch>
            {/* missing */}
            <Match when={handle() === null}>
                <NotFound />
            </Match>

            {/* handle */}
            <Match when={handle() !== undefined}>
                <>
                    <Seo title={`@${props.handle}`} description="zurich.tech handle lookup." />
                    <Page width="narrow">
                        <PageHeader
                            summary={member()?.summary ?? "handle not found."}
                            title={title()}
                        />

                        {/* target */}
                        <Card title="Profile">
                            <Show
                                when={member()}
                                fallback={
                                    <p class="text-soft">No public profile uses this handle.</p>
                                }
                            >
                                {(target) => (
                                    <Button href={target().href} kind="ghost">
                                        Open profile
                                    </Button>
                                )}
                            </Show>
                        </Card>
                    </Page>
                </>
            </Match>
        </Switch>
    );
}

/** Member handle target. */
function memberHandle(handle: PublicHandle | null | undefined): PublicHandle | null {
    if (handle?.type !== "member") {
        return null;
    }

    return handle;
}
