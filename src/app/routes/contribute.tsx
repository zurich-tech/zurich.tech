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
                    summary="Bring a speaker, organise an event, or spread the word."
                />
                <div class="listing-layout">
                    <div class="contribute-options">
                        <Card title="Events">
                            <div class="contribute-options">
                                <section id="speakers">
                                    <h3>Suggest a speaker</h3>
                                    <p>
                                        Know someone with an interesting project, idea or story?
                                        Tell us about them.
                                    </p>
                                    <a
                                        class="button button--primary"
                                        href={site.socials.discord}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Suggest a speaker <Arrow direction="external" />
                                    </a>
                                </section>
                                <section>
                                    <h3>Give a talk</h3>
                                    <p>Share what you’re building, researching or learning.</p>
                                    <a
                                        class="button"
                                        href={site.socials.discord}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Become a speaker <Arrow direction="external" />
                                    </a>
                                </section>
                                <section id="events">
                                    <h3>Organise an event</h3>
                                    <p>
                                        Help with an existing series, or propose a talk, dinner,
                                        workshop, hackathon or something new.
                                    </p>
                                    <a
                                        class="button"
                                        href={site.socials.discord}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Suggest an event <Arrow direction="external" />
                                    </a>
                                </section>
                            </div>
                        </Card>
                        <Share title={site.name} url={site.url} />
                    </div>
                    <aside class="listing-sidebar">
                        <Card title="Community">
                            <p>Join the conversation, answer questions, and welcome new members.</p>
                            <a
                                class="button button--primary"
                                href={site.socials.discord}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Join Discord <Arrow direction="external" />
                            </a>
                        </Card>
                        <Card title="Support">
                            <p>Support our events as an individual or an organisation.</p>
                            <a class="button" href="/sponsor">
                                Sponsors <Arrow />
                            </a>
                        </Card>
                    </aside>
                </div>
            </Page>
        </>
    );
}
