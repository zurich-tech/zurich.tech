import { A } from "@solidjs/router";
import { For } from "solid-js";
import wordmark from "../components/assets/wordmark.svg?raw";
import { SocialLinks } from "../components/social";
import { Newsletter } from "../mail/newsletter";
import { site } from "./site";

/** Footer link groups in reading order. */
const groups = [
    {
        title: "Programme",
        links: [
            { label: "Events", href: "/events" },
            { label: "Series", href: "/series" },
            { label: "News", href: "/news" },
            { label: "Jobs", href: "/jobs" },
            { label: "Map", href: "/map" },
        ],
    },
    {
        title: "Community",
        links: [
            { label: "About", href: "/about" },
            { label: "Contribute", href: "/contribute" },
            { label: "Sponsor", href: "/sponsor" },
            { label: "Stats", href: "/stats" },
            { label: "Legal", href: "/legal" },
        ],
    },
];

/** Close every page with the brand, navigation and the newsletter in one compact band. */
export function Footer() {
    return (
        <footer class="site-footer">
            <div class="site-footer__body">
                {/* identity, association and channels */}
                <div class="site-footer__brand">
                    <A class="site-footer__wordmark" href="/" aria-label="zurich.tech home">
                        <span aria-hidden="true" innerHTML={wordmark} />
                    </A>
                    <p>A volunteer-run non-profit for people in tech around Zurich.</p>
                    <SocialLinks name={site.name} profiles={site.socials} />
                </div>

                {/* weekly email */}
                <Newsletter />
            </div>

            {/* secondary navigation */}
            <div class="site-footer__navigation">
                <For each={groups}>
                    {(group) => (
                        <nav class="site-footer__group" aria-label={group.title}>
                            <h2>{group.title}</h2>
                            <For each={group.links}>
                                {(link) => <A href={link.href}>{link.label}</A>}
                            </For>
                        </nav>
                    )}
                </For>
            </div>
        </footer>
    );
}
