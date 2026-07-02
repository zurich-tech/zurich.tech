/** Avatar. */
export function Avatar(props: { name: string }) {
    const initial = props.name.slice(0, 1).toLowerCase();

    return (
        <div class="flex size-9 shrink-0 items-center justify-center border border-line bg-wash text-sm text-ink">
            {initial}
        </div>
    );
}
