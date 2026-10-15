import wordmark from "../components/assets/wordmark.svg?raw";
import { CommunityMap } from "../map/map";

/** Open the homepage with the city map and wordmark. */
export function Hero() {
    return (
        <header class="hero">
            {/* render the geographic map behind the wordmark */}
            <CommunityMap isHero />

            {/* anchor the wordmark to the banner edges */}
            <h1 class="hero-wordmark" aria-label="zurich.tech" innerHTML={wordmark} />
        </header>
    );
}
