import { HttpStatusCode } from "@solidjs/start";
import { Arrow } from "../components/arrow";
import { Page, PageHeader } from "./page";
import { Seo } from "./seo";

/** Explain a missing page and return visitors to the calendar. */
export function NotFound() {
    return (
        <>
            <HttpStatusCode code={404} />
            <Seo title="Page not found" description="This page could not be found." />
            <Page width="narrow">
                <p class="eyebrow">404</p>
                <PageHeader title="Page not found" />
                <p>This link may be out of date.</p>
                <a class="text-link" href="/events">
                    <Arrow direction="left" /> Back to events
                </a>
            </Page>
        </>
    );
}
