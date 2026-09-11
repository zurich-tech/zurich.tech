import { createAsync } from "@solidjs/router";
import { Show } from "solid-js";
import { Gallery } from "../component/gallery";
import { Page } from "../component/page";
import { Seo } from "../component/seo";
import { getGallery } from "../core/queries";

/** Browse photographs from the community’s events. */
export default function Route() {
    const albums = createAsync(() => getGallery());

    return (
        <>
            <Seo
                title="Photos"
                description="Photos from zurich.tech talks, meetups and community events."
            />
            <Page class="photos-page">
                <Gallery albums={albums() ?? []} isPage />
                <Show when={albums()?.length === 0}>
                    <p>No event photos published yet.</p>
                </Show>
            </Page>
        </>
    );
}
