import { Card } from "../../components/card";
import { Share } from "../../components/share";
import { Arrow } from "../../components/arrow";
import { Page, PageHeader } from "../page";
import { Seo } from "../seo";
import { site } from "../site";
import "../contribute.css";

/** Offer practical ways to help the community and its events. */
export default function Route() {
    return (
        <>
            <Seo
                title="Contribute"
                description="Suggest a speaker, give a talk, organise an event or help spread the word about zurich.tech."
            />
            <Page>
                <PageHeader
                    title="Contribute"
                    summary="Give a talk, help with an event, or tell a friend."
                />
                <div class="listing-layout">
                    <div class="listing-main">
                        <Card title="Events">
                            <div class="contribute-options">
                                <section id="speakers">
                                    <h3>Suggest a speaker</h3>
                                    <p>
                                        Know someone you’d like to hear speak? Send us their name
                                        and a topic.
                                    </p>
                                    <a
                                        class="action-link"
                                        href={`mailto:${site.email}?subject=Speaker%20suggestion`}
                                    >
                                        Suggest a speaker <Arrow />
                                    </a>
                                </section>
                                <section id="talks">
                                    <h3>Give a talk</h3>
                                    <p>Share what you’re building, researching or learning.</p>
                                    <a
                                        class="action-link"
                                        href={`mailto:${site.email}?subject=Talk%20proposal`}
                                    >
                                        Propose a talk <Arrow />
                                    </a>
                                </section>
                                <section id="events">
                                    <h3>Organise an event</h3>
                                    <p>Help run an event, or suggest one you’d like to organise.</p>
                                    <a
                                        class="action-link"
                                        href={`mailto:${site.email}?subject=Event%20proposal`}
                                    >
                                        Propose an event <Arrow />
                                    </a>
                                </section>
                                <section id="venues">
                                    <h3>Provide a venue</h3>
                                    <p>Have space for a talk, workshop or community event?</p>
                                    <a
                                        class="action-link"
                                        href={`mailto:${site.email}?subject=Venue%20offer`}
                                    >
                                        Offer a venue <Arrow />
                                    </a>
                                </section>
                            </div>
                        </Card>
                        <Share title={site.name} url={site.url} />
                    </div>
                    <aside class="listing-sidebar">
                        <Card title="Community">
                            <p>Come chat with us on Discord.</p>
                            <a
                                class="button button--primary"
                                href={site.socials.discord}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Join the Discord <Arrow direction="external" />
                            </a>
                        </Card>
                        <Card title="Support">
                            <p>Support our events as an individual or an organisation.</p>
                            <a class="text-link" href="/sponsor">
                                Become a sponsor <Arrow />
                            </a>
                        </Card>
                    </aside>
                </div>
            </Page>
        </>
    );
}
