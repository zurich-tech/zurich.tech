import { site } from "../core/constants";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";

import graphic from "../assets/map.svg?raw";

/** Keep the city and wordmark consistent across the site. */
export function Hero(props: {
    /** Use a shorter banner on inner pages. */
    isCompact?: boolean;
    /** Published events shown on the homepage. */
    eventCount?: number;
}) {
    return (
        <header class="bulletin-masthead" classList={{ "hero-compact": props.isCompact }}>
            {/* render the inert city geometry behind the wordmark */}
            <div class="circuit-map" innerHTML={graphic} aria-hidden="true" />
            {/* show community counts on the landing page */}
            <Show when={!props.isCompact}>
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
