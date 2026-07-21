import { For } from "solid-js";

/** Tags. */
export function Tags(props: { values: string[] }) {
    return (
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs lowercase text-soft">
            {/* tags */}
            <For each={props.values}>{(value) => <span>#{value}</span>}</For>
        </div>
    );
}

/** External links. */
export function ExternalLinks(props: { links: Array<{ href: string; label: string }> }) {
    return (
        <div class="flex flex-wrap gap-3 text-xs lowercase">
            {/* links */}
            <For each={props.links}>
                {(link) => (
                    <a
                        class="text-soft underline underline-offset-4 hover:text-ink"
                        href={link.href}
                    >
                        {link.label}
                    </a>
                )}
            </For>
        </div>
    );
}
