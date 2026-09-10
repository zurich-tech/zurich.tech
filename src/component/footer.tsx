import { Wordmark } from "./wordmark";

/** Provide compact community, account, and provenance links. */
export function Footer() {
    return (
        <footer class="utility-footer">
            <span>
                <Wordmark />
            </span>
            <nav aria-label="Footer">
                <a href="/about">About</a>
                <a href="/news">News</a>
                <a href="/sponsor">Sponsor</a>
                <a href="/privacy">Privacy</a>
                <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>
                <a href="/admin">Workspace</a>
            </nav>
            <span>Zürich, Switzerland</span>
        </footer>
    );
}
