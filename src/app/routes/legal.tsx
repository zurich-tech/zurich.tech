import { Card } from "../../components/card";
import { Page, PageHeader } from "../page";
import { Seo } from "../seo";

/** Present privacy information and third-party attributions. */
export default function Route() {
    return (
        <>
            <Seo title="Legal" description="Privacy, credits and licences for zurich.tech." />
            <Page width="narrow">
                <PageHeader title="Legal" />
                <Card title="Privacy" id="privacy">
                    <div class="markdown">
                        <ul>
                            <li>
                                GitHub or Google sign-in shares your name, verified email and
                                profile photo with us. Sponsor recognition is public only when
                                enabled in settings.
                            </li>
                            <li>
                                We use your email for registrations and event updates. Organisers
                                and the team can see registration details and answers. Registration
                                also subscribes you to event emails unless you’ve opted out. Every
                                newsletter includes an unsubscribe link; registration emails include
                                a private management link.
                            </li>
                            <li>
                                Convex stores account and event records. Resend delivers email.
                                Photon receives address searches. We use necessary sign-in storage,
                                with no advertising trackers.
                            </li>
                            <li>
                                Sponsorships are arranged by email. Billing details are visible to
                                the organisation owner and our team. Job applications go directly to
                                employers.
                            </li>
                            <li>
                                To access, correct or delete your data, email{" "}
                                <a class="text-link" href="mailto:hello@zurich.tech">
                                    hello@zurich.tech
                                </a>
                                .
                            </li>
                        </ul>
                    </div>
                </Card>
                <Card title="Licences" id="licences">
                    <div class="markdown">
                        <ul>
                            <li>
                                Map data: ©{" "}
                                <a class="text-link" href="https://www.openstreetmap.org/copyright">
                                    OpenStreetMap contributors
                                </a>{" "}
                                (ODbL). Tiles:{" "}
                                <a class="text-link" href="https://openfreemap.org/">
                                    OpenFreeMap
                                </a>{" "}
                                and OpenStreetMap. Rendering:{" "}
                                <a class="text-link" href="https://maplibre.org/">
                                    MapLibre
                                </a>
                                .
                            </li>
                            <li>
                                Icons:{" "}
                                <a class="text-link" href="https://fontawesome.com/license/free">
                                    Font Awesome Free
                                </a>{" "}
                                by Fonticons, Inc. —{" "}
                                <a
                                    class="text-link"
                                    href="https://creativecommons.org/licenses/by/4.0/"
                                >
                                    CC BY 4.0
                                </a>
                                .
                            </li>
                            <li>
                                Fonts:{" "}
                                <a class="text-link" href="/licenses/archivo.txt">
                                    Archivo
                                </a>{" "}
                                and{" "}
                                <a class="text-link" href="/licenses/jetbrains-mono.txt">
                                    JetBrains Mono
                                </a>{" "}
                                — SIL Open Font Licence 1.1. Links include copyright notices and
                                full licences.
                            </li>
                        </ul>
                    </div>
                </Card>
            </Page>
        </>
    );
}
