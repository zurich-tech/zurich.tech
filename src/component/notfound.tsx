import { Page, Section } from "./page";
import { Seo } from "./seo";

// tiny ascii shield, echoes the home page's pixel shield
const shield = ["▗▄▄▄▖", "▐ · ▌", "▝▀▄▀▘"].join("\n");

/** Not found page body. */
export function NotFound() {
    return (
        <>
            <Seo title="not found" description="route not found." />
            <Page width="narrow">
                <Section title="404">
                    {/* shield */}
                    <pre class="mb-3 text-soft select-none">{shield}</pre>

                    {/* body */}
                    <p class="text-ink">not found</p>
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
