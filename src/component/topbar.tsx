import { A } from "@solidjs/router";
import { For } from "solid-js";

const links = [
    { href: "/events", key: "e", rest: "vents" },
    { href: "/series", key: "s", rest: "eries" },
    { href: "/members", key: "m", rest: "embers" },
    { href: "/blog", key: "b", rest: "log" },
];

/** Top status bar. */
export function Topbar() {
    return (
        <header class="apron-down sticky top-0 z-10 border-b border-ink bg-bar text-bar-text">
            {/* layout */}
            <div class="mx-auto grid h-10 max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 text-xs md:px-6">
                {/* brand */}
                <A class="font-medium" href="/">
                    zurich.tech
                </A>

                {/* accelerator nav */}
                <nav class="flex items-center gap-2 md:gap-4">
                    <For each={links}>
                        {(link) => (
                            <A
                                class="whitespace-nowrap text-bar-soft hover:bg-bar-text hover:text-bar"
                                href={link.href}
                            >
                                <span class="text-bar-text">[{link.key}]</span>
                                <span class="hidden sm:inline">{link.rest}</span>
                            </A>
                        )}
                    </For>
                </nav>

                {/* login */}
                <A
                    class="justify-self-end whitespace-nowrap text-bar-soft hover:bg-bar-text hover:text-bar"
                    href="/settings"
                >
                    <span class="text-bar-text">[l]</span>
                    <span class="hidden sm:inline">ogin</span>
                </A>
            </div>
        </header>
    );
}
