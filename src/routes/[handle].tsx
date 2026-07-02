import { createAsync, useParams } from "@solidjs/router";
import { Show } from "solid-js";

import { Button } from "../component/button";
import { Page, PageHeader, Section } from "../component/page";
import { Seo } from "../component/seo";
import { getHandle, type PublicHandle } from "../data/public";
import { NotFound } from "../component/notfound";

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
    const handle = createAsync(() => getHandle(props.handle));
    const member = () => memberHandle(handle());
    const title = () => member()?.title ?? `@${props.handle}`;

    return (
        <>
            <Seo title={`@${props.handle}`} description="zurich.tech handle lookup." />
            <Page width="narrow">
                <PageHeader summary={member()?.summary ?? "handle not found."} title={title()} />

                {/* target */}
                <Section title="target">
                    <Show
                        when={member()}
                        fallback={<p class="text-soft">no member claims this handle.</p>}
                    >
                        {(target) => (
                            <Button href={target().href} kind="ghost">
                                open member profile
                            </Button>
                        )}
                    </Show>
                </Section>
            </Page>
        </>
    );
}

/** Member handle target. */
function memberHandle(handle: PublicHandle | null | undefined): PublicHandle | null {
    if (handle?.type !== "member") {
        return null;
    }

    return handle;
}
