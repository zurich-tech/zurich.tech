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

/** Progress. */
export function Progress(props: { label: string; max: number; value: number }) {
    // bar width
    const width = `${Math.min(100, Math.round((100 * props.value) / props.max))}%`;

    return (
        <div class="grid gap-1.5">
            <div class="flex justify-between gap-3 text-xs lowercase text-soft">
                <span>{props.label}</span>
                <span>
                    {props.value}/{props.max}
                </span>
            </div>
            {/* bar */}
            <div class="h-1 bg-wash">
                <div class="h-full bg-ink" style={{ width }} />
            </div>
        </div>
    );
}
