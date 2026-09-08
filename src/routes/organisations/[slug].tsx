import { getDirectory } from "../../core/queries";
import { Arrow } from "../../component/arrow";
import { createAsync, useParams } from "@solidjs/router";
import { Show } from "solid-js";

import { Page, PageHeader } from "../../component/page";
import { Seo } from "../../component/seo";
import { NotFound } from "../../component/notfound";

/** Show a curated organisation's work and community role. */
export default function Route() {
    const params = useParams();
    const directory = createAsync(() => getDirectory());
    const organisation = () => directory()?.organisations.find((item) => item.slug === params.slug);

    return (
        <Show when={organisation()} fallback={directory() ? <NotFound /> : null}>
            {(item) => (
                <>
                    <Seo title={item().name} description={item().description} />
                    <Page width="narrow">
                        <a class="eyebrow" href="/organisations">
                            <Arrow direction="left" /> Organisations
                        </a>
                        <PageHeader title={item().name} />
                        <p class="eyebrow">
                            {item().kind} · {item().location}
                        </p>
                        <p class="page-lead">{item().description}</p>
                        <Show when={item().isSponsor}>
                            <p class="supporter-note">Supports the zurich.tech community.</p>
                        </Show>
                        <a class="button" href={item().website} target="_blank" rel="noreferrer">
                            Visit website <Arrow direction="external" />
                        </a>
                    </Page>
                </>
            )}
        </Show>
    );
}
