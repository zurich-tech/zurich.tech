import { For } from "solid-js";

const links = [
    { href: "https://x.com/zurichnlp", label: "x" },
    { href: "https://www.linkedin.com/company/zurichai", label: "linkedin" },
    { href: "/admin", label: "admin" },
];

/** Bottom status bar, mirroring the top one. */
export function Footer() {
    return (
        <footer class="apron-up sticky bottom-0 z-10 border-t border-ink bg-bar text-bar-text">
            {/* layout */}
            <div class="mx-auto grid h-10 max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 text-xs md:px-6">
                <p class="truncate font-medium">zurich.tech</p>

                {/* links */}
                <nav class="flex gap-4">
                    <For each={links}>
                        {(link) => (
                            <a
                                class="text-bar-soft hover:bg-bar-text hover:text-bar"
                                href={link.href}
                            >
                                {link.label}
                            </a>
                        )}
                    </For>
                </nav>

                <p class="justify-self-end truncate text-bar-soft">zürich, switzerland</p>
            </div>
        </footer>
    );
}
