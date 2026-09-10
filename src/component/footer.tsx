import { Wordmark } from "./wordmark";

/** Provide the site identity and consolidated legal information. */
export function Footer() {
    return (
        <footer class="utility-footer">
            <span>
                <Wordmark />
            </span>
            <nav aria-label="Footer">
                <a href="/legal">Legal</a>
            </nav>
        </footer>
    );
}
