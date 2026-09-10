import { Card } from "../component/card";
import { Page, PageHeader } from "../component/page";
import { Seo } from "../component/seo";

/** Present privacy information and third-party attributions. */
export default function Route() {
    return (
        <>
            <Seo title="Legal" description="Privacy, credits and licences for zurich.tech." />
            <Page width="narrow">
                <PageHeader title="Legal" />
                <Card title="Privacy" id="privacy">
                    <p>
                        We use your email to confirm registrations and communicate event changes.
                        Event organisers and the team can access the attendee details and answers
                        needed to run their events. Confirming your registration also subscribes you
                        to future event emails.
                    </p>
                    <p>
                        Every newsletter has an unsubscribe link. Registration emails include a
                        private management link. Account and event records are stored in Convex;
                        email is delivered through Resend. The site uses necessary authentication
                        storage and does not include advertising trackers.
                    </p>
                    <p>
                        Signing in with GitHub or X shares your name, verified email and profile
                        image with us. Your avatar refreshes when you sign in. Patron recognition is
                        public only if you enable it in settings.
                    </p>
                    <p>
                        Stripe processes payments and invoices. We retain payment references and
                        membership terms; card details stay with Stripe. Company billing details are
                        visible to the company owner and our team. Job applications go to the
                        employer’s application site.
                    </p>
                    <p>
                        For access, correction, or deletion requests, contact{" "}
                        <a class="text-link" href="mailto:hello@zurich.tech">
                            hello@zurich.tech
                        </a>
                        .
                    </p>
                </Card>
                <Card title="Credits and licences" id="licences">
                    <p>
                        Maps use tiles from{" "}
                        <a class="text-link" href="https://openfreemap.org/">
                            OpenFreeMap
                        </a>
                        , rendered with{" "}
                        <a class="text-link" href="https://maplibre.org/">
                            MapLibre
                        </a>
                        , and data from © OpenStreetMap contributors. Map data is available under
                        the Open Database Licence (ODbL). See the{" "}
                        <a class="text-link" href="https://www.openstreetmap.org/copyright">
                            OpenStreetMap copyright and licence information
                        </a>
                        .
                    </p>
                    <p>
                        Social icons are from Font Awesome Free by Fonticons, Inc., licensed under{" "}
                        <a class="text-link" href="https://creativecommons.org/licenses/by/4.0/">
                            Creative Commons Attribution 4.0
                        </a>
                        . See the{" "}
                        <a class="text-link" href="https://fontawesome.com/license/free">
                            Font Awesome licence
                        </a>
                        .
                    </p>
                    <p>
                        Archivo and JetBrains Mono are distributed under the SIL Open Font Licence
                        1.1. Their copyright notices and full licences are available for{" "}
                        <a class="text-link" href="/licenses/archivo.txt">
                            Archivo
                        </a>{" "}
                        and{" "}
                        <a class="text-link" href="/licenses/jetbrains-mono.txt">
                            JetBrains Mono
                        </a>
                        .
                    </p>
                </Card>
            </Page>
        </>
    );
}
