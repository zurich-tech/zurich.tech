import { Show, splitProps, type JSX } from "solid-js";
import { isHostedLogo } from "../organisations/logos";

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
                decoding="async"
                {...attributes}
                crossorigin={isHostedLogo(sources.src) ? "anonymous" : attributes.crossorigin}
                src={sources.src}
                classList={{ ...sources.classList, "image--light": Boolean(sources.darkSrc) }}
            />
            <Show when={sources.darkSrc}>
                {(source) => (
                    <img
                        decoding="async"
                        {...attributes}
                        crossorigin={isHostedLogo(source()) ? "anonymous" : attributes.crossorigin}
                        src={source()}
                        classList={{ ...sources.classList, "image--dark": true }}
                    />
                )}
            </Show>
        </>
    );
}
