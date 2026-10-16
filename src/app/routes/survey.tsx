import { Survey } from "../../members/survey";
import { Page, PageHeader } from "../page";
import { Seo } from "../seo";

/** Open the optional guided survey from event QR codes and reminder links. */
export default function Route() {
    return (
        <>
            <Seo title="About you" description="Help us make better events for everyone." />
            <Page class="survey-page publication">
                <PageHeader title="About you" summary="Help us make better events for everyone." />
                <Survey />
            </Page>
        </>
    );
}
