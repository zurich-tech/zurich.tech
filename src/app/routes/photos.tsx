import { Show } from "solid-js";
import { Gallery } from "../../events/gallery";
import { Page } from "../page";
import { Card } from "../../components/card";
import { Arrow } from "../../components/arrow";
import { Contribute } from "../contribute";
import { site } from "../site";
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
                <div class="listing-layout">
                    <div class="listing-main">
                        <Gallery albums={albums() ?? []} isPage />
                        <Show when={albums()?.length === 0}>
                            <p class="empty-copy">No event photos published yet.</p>
                        </Show>
                    </div>

                    {/* ask attendees for their photos */}
                    <aside class="listing-sidebar">
                        <Card title="Share your photos" class="offer-card">
                            <p>
                                Took photos at one of our events? Send them over and we'll add them
                                to the album.
                            </p>
                            <a
                                class="button button--primary"
                                href={site.socials.discord}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Send on Discord <Arrow direction="external" />
                            </a>
                        </Card>
                        <Contribute />
                    </aside>
                </div>
            </Page>
        </>
    );
}
