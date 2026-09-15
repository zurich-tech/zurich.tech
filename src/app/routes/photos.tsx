import { Show } from "solid-js";
import { Gallery } from "../../events/gallery";
import { Page } from "../page";
import { Seo } from "../seo";
import { getGallery } from "../../events/queries";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => getGallery(),
};

/** Browse photographs from the community’s events. */
export default function Route() {
    const albums = getGallery.use(() => []);

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
