import { Card } from "../component/card";
import { Page, PageHeader } from "../component/page";
import { Seo } from "../component/seo";

/** Explain how event and account information is used. */
export default function Route() {
    return (
        <>
            <Seo title="Privacy" description="How zurich.tech uses your information." />
            <Page width="narrow">
                <PageHeader title="Privacy" />
                <Card title="Your information">
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
            </Page>
        </>
    );
}
