import { Page, Section } from "./page";
import { Seo } from "./seo";

/** Not found page body. */
export function NotFound() {
    return (
        <>
            <Seo title="not found" description="route not found." />
            <Page width="narrow">
                <Section title="404">
                    {/* body */}
                    <p class="text-ink">&gt; not found</p>
                    <a
                        class="mt-1 inline-block underline underline-offset-4 hover:bg-ink hover:text-paper"
                        href="/"
                    >
                        back home
                    </a>
                </Section>
            </Page>
        </>
    );
}
