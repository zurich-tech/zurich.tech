import { createAsync } from "@solidjs/router";
import { For, onMount } from "solid-js";

import { Button } from "../component/button";
import { Calendar } from "../component/calendar";
import { Section } from "../component/page";
import { Seo } from "../component/seo";
import { subscribe } from "../data/actions";
import { getCalendar, getStats, splitCalendar, type CommunityStats } from "../data/public";

const pastLimit = 8;

/** Home page. */
export default function Route() {
    // calendar
    const entries = createAsync(() => getCalendar());
    const stats = createAsync(() => getStats());
    const split = () => splitCalendar(entries() ?? []);

    return (
        <>
            <Seo title="zurich.tech" description="the tech community in zürich." />
            <section class="mx-auto grid max-w-5xl gap-6 px-4 pt-8 pb-8 md:px-6">
                <Hero stats={stats()} />
                <Calendar entries={split().upcoming} title="upcoming" />
                <Calendar
                    entries={split().past.slice(0, pastLimit)}
                    title="past"
                    more={{ href: "/events", label: "all events →" }}
                />
                <SubscribeBox />

                {/* terminal help line */}
                <p class="text-xs text-soft">
                    <span class="text-ink">j/k</span> select · <span class="text-ink">enter</span>{" "}
                    open · <span class="text-ink">e s m b</span> navigate
                </p>
            </section>
        </>
    );
}

/** Hero: scrambling wordmark and tagline, live totals in a 2x2 box. */
function Hero(props: { stats: CommunityStats | undefined }) {
    let mark!: HTMLSpanElement;
    let tld!: HTMLSpanElement;

    // decode the wordmark on load
    onMount(() => {
        scramble(mark, "zurich");
        setTimeout(() => scramble(tld, ".tech"), 250);
    });

    // labelled totals
    const items = () => [
        { label: "members", value: props.stats?.members },
        { label: "events", value: props.stats?.events },
        { label: "attendees", value: props.stats?.attendees },
        { label: "series", value: props.stats?.series },
    ];

    return (
        <div class="grid items-center gap-6 py-4 md:grid-cols-[1fr_auto] md:gap-8">
            {/* wordmark */}
            <div>
                <h1 class="text-4xl leading-tight font-semibold tracking-tight md:text-5xl">
                    <span ref={mark}>zurich</span>
                    <span class="text-soft" ref={tld}>
                        .tech
                    </span>
                    <span class="cursor-block" />
                </h1>
                <p class="mt-3 max-w-xl text-soft">
                    the tech community in zürich. talks, meetups, hack nights.
                </p>
            </div>

            {/* live totals */}
            <div class="pixel-box grid grid-cols-2 gap-x-10 gap-y-3 p-4 pt-5 md:min-w-64">
                <span class="pixel-label">
                    <span class="font-medium text-ink">community</span> · live
                </span>
                <For each={items()}>
                    {(item) => (
                        <div class="grid">
                            <span class="text-xl leading-snug font-semibold tabular-nums">
                                {item.value ?? "–"}
                            </span>
                            <span class="text-xs text-soft">{item.label}</span>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}

/** Newsletter box. */
function SubscribeBox() {
    // submission
    async function submit(submitEvent: SubmitEvent) {
        submitEvent.preventDefault();

        const form = submitEvent.currentTarget as HTMLFormElement;
        const email = String(new FormData(form).get("email") ?? "");

        // require email
        if (email.length === 0) {
            return;
        }

        // subscribe
        await subscribe(email);
        form.reset();
    }

    return (
        <Section title="newsletter" meta="one mail per month">
            {/* form */}
            <form class="flex max-w-md gap-2" onSubmit={submit}>
                <input
                    class="w-full min-w-0 border border-ink bg-transparent px-3 py-1.5 text-sm outline-none placeholder:text-soft/60 focus:shadow-[4px_4px_0_0_var(--dith)]"
                    name="email"
                    placeholder="you@example.com"
                    type="email"
                />
                <Button type="submit">subscribe</Button>
            </form>
        </Section>
    );
}

const scramblePool = "!<>-_\\/[]{}—=+*^?#________";

/** Resolve an element's text left to right through glitch characters. */
function scramble(el: HTMLElement, target: string) {
    // respect reduced motion
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        el.textContent = target;
        return;
    }

    // settle characters over 900ms
    const start = performance.now();
    function tick(now: number) {
        const progress = Math.min(1, (now - start) / 900);
        const settled = Math.floor(progress * target.length);

        let out = target.slice(0, settled);
        for (let i = settled; i < target.length; i++) {
            out += scramblePool[(Math.random() * scramblePool.length) | 0];
        }
        el.textContent = out;

        if (progress < 1) {
            requestAnimationFrame(tick);
        }
    }

    requestAnimationFrame(tick);
}
