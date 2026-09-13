import { A } from "@solidjs/router";
import { Brand } from "./brand";

/** Provide the site identity and consolidated legal information. */
export function Footer() {
    return (
        <footer class="utility-footer">
            <A class="footer-logo" href="/" aria-label="zurich.tech home">
                <Brand />
            </A>
            <A class="footer-wordmark" href="/">
                zurich.tech
            </A>
            <nav aria-label="Footer">
                <a href="/contribute">Contribute</a>
                <a href="/legal">Legal</a>
            </nav>
        </footer>
    );
}
