import { Show, splitProps, type JSX } from "solid-js";

/** Display the image matching the site theme, or the same source in both themes. */
export function Image(
    props: JSX.ImgHTMLAttributes<HTMLImageElement> & {
        /** Optional source for the site's dark theme. */
        darkSrc?: string;
    },
) {
    const [sources, attributes] = splitProps(props, ["src", "darkSrc", "classList"]);

    return (
        <>
            <img
                {...attributes}
                src={sources.src}
                classList={{ ...sources.classList, "image--light": Boolean(sources.darkSrc) }}
            />
            <Show when={sources.darkSrc}>
                {(source) => (
                    <img
                        {...attributes}
                        src={source()}
                        classList={{ ...sources.classList, "image--dark": true }}
                    />
                )}
            </Show>
        </>
    );
}
