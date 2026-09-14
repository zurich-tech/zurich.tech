import { site } from "./site";

import { useLocation } from "@solidjs/router";
import { Meta, Title } from "@solidjs/meta";
import { createMemo, Show } from "solid-js";

/** Set page-specific search and social metadata with a trusted image origin. */
export function Seo(props: {
    /** Page title before the site name. */
    title: string;
    /** Search and social preview description. */
    description: string;
    /** Public preview image; omitted pages use the shared site image. */
    image?: string;
    /** Use the site name alone for the landing page title. */
    isHome?: boolean;
    /** Article previews use the standard article graph type. */
    isArticle?: boolean;
}) {
    // derive canonical metadata and exclude private account pages
    const location = useLocation();
    const isPrivate = () =>
        /^\/(admin|manage|settings|welcome|sign-in|submit|confirm|registration|unsubscribe|payment)(\/|$)/.test(
            location.pathname,
        ) || ["/jobs/submit", "/news/edit"].includes(location.pathname);
    const url = () => `${site.url}${location.pathname}`;

    // evaluate page props within this component, including metadata read during cleanup
    const metadata = createMemo(() => ({
        title: props.isHome ? site.name : `${props.title} - ${site.name}`,
        description: props.description,
        image: props.image ?? `${site.url}/og.png`,
        imageAlt: props.title,
        type: props.isArticle ? "article" : "website",
    }));

    return (
        <>
            <Title>{metadata().title}</Title>
            <Show when={isPrivate()}>
                <Meta name="robots" content="noindex, nofollow" />
            </Show>
            <Meta name="description" content={metadata().description} />
            <Meta property="og:title" content={metadata().title} />
            <Meta property="og:description" content={metadata().description} />
            <Meta property="og:url" content={url()} />
            <Meta property="og:site_name" content={site.name} />
            <Meta property="og:type" content={metadata().type} />
            <Meta property="og:locale" content="en_GB" />
            <Meta name="twitter:card" content="summary_large_image" />
            <Meta name="twitter:title" content={metadata().title} />
            <Meta name="twitter:description" content={metadata().description} />
            <Meta property="og:image" content={metadata().image} />
            <Meta property="og:image:alt" content={metadata().imageAlt} />
            <Meta name="twitter:image" content={metadata().image} />
        </>
    );
}
