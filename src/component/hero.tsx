import { site } from "../core/constants";
import { SocialLinks } from "./social";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";

import { CommunityMap } from "./map";

/** Keep the city and wordmark consistent across the site. */
export function Hero(props: {
    /** Use a shorter banner on inner pages. */
    isCompact?: boolean;
    /** Published events shown on the homepage. */
    eventCount?: number;
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
                                <dd>{props.eventCount}</dd>
                            </div>
                        </Show>
                        <div>
                            <dt>Members</dt>
                            <dd>{`${site.members.toLocaleString("en-GB")}+`}</dd>
                        </div>
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
                >
                    zurich
                    <span class="wordmark-dot">.</span>
                    tech
                </Dynamic>
            </div>
        </header>
    );
}
