import { getHandle, type PublicHandle } from "../../members/queries";
import { Card } from "../../components/card";
import { useParams } from "@solidjs/router";
import { Match, Show, Switch } from "solid-js";

import { Button } from "../../components/button";
import { NotFound } from "../notfound";
import { Page, PageHeader } from "../page";
import { Seo } from "../seo";

/** Handle lookup. */
export default function Route() {
    // handle segment
    const params = useParams();
    const segment = () => params.handle ?? "";

    return (
        <Show when={segment().startsWith("@")} fallback={<NotFound />}>
            <HandleTarget handle={segment().slice(1)} />
        </Show>
    );
}

/** Handle target lookup and profile shortcut. */
function HandleTarget(props: { handle: string }) {
    // handle
    const handle = getHandle.use(() => [props.handle]);
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
                    <Seo title={title()} description="zurich.tech handle lookup." />
                    <Page class="publication" width="narrow">
                        <PageHeader summary={member()?.summary} title={title()} />

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
