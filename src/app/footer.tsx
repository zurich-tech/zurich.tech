import { A } from "@solidjs/router";
import { SocialLinks } from "../components/social";
import { site } from "./site";

/** Site identity, community links and social accounts. */
export function Footer() {
    return (
        <footer class="utility-footer">
            <A class="footer-wordmark" href="/" aria-label="zurich.tech home">
                zurich.tech
            </A>
            <nav aria-label="Footer">
                <A href="/about">About</A>
                <A href="/sponsor">Sponsor</A>
                <A href="/contribute">Contribute</A>
                <A href="/legal">Legal</A>
            </nav>
            <SocialLinks name={site.name} profiles={site.socials} />
        </footer>
    );
}
