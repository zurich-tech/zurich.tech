import wordmark from "../components/assets/wordmark.svg?raw";
import { site } from "./site";
import { SocialLinks } from "../components/social";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";

import { CommunityMap } from "../map/map";

/** Format a conservative community milestone. */
function milestone(count: number, step: number) {
    return `${(Math.floor(count / step) * step).toLocaleString("en-GB")}+`;
}

/** Keep the city and wordmark consistent across the site. */
export function Hero(props: {
    /** Use a shorter banner on inner pages. */
    isCompact?: boolean;
    /** Published events shown on the homepage. */
    eventCount?: number;
    /** Current community members with an active subscription. */
    memberCount?: number;
}) {
    return (
        <header class="bulletin-masthead" classList={{ "hero-compact": props.isCompact }}>
            {/* render the geographic map behind the wordmark */}
            <CommunityMap isHero isDecorative={props.isCompact} />
            {/* show community counts on the landing page */}
            <Show when={!props.isCompact}>
                <div class="hero-toolbar">
                    <dl class="hero-stats">
                        <Show when={props.eventCount !== undefined}>
                            <div>
                                <dt>Events</dt>
                                <dd>{milestone(props.eventCount!, 10)}</dd>
                            </div>
                        </Show>
                        <Show when={props.memberCount !== undefined}>
                            <div>
                                <dt>Members</dt>
                                <dd>{milestone(props.memberCount!, 1000)}</dd>
                            </div>
                        </Show>
                    </dl>
                    <nav aria-label="Community social channels">
                        <SocialLinks name={site.name} profiles={site.socials} labelled />
                    </nav>
                </div>
            </Show>
            {/* anchor the wordmark to the banner edges */}
            <div class="bulletin-name">
                <Dynamic
                    component={props.isCompact ? "div" : "h1"}
                    class="hero-title"
                    aria-label="zurich.tech"
                    innerHTML={wordmark}
                />
            </div>
        </header>
    );
}
