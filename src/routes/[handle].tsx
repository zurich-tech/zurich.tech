import { getHandle, type PublicHandle } from "../core/queries";
import { Card } from "../component/card";
import { createAsync, useParams } from "@solidjs/router";
import { Match, Show, Switch } from "solid-js";

import { Button } from "../component/button";
import { NotFound } from "../component/notfound";
import { Page, PageHeader } from "../component/page";
import { Seo } from "../component/seo";

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
