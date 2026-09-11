import { site } from "./site";

import { useLocation } from "@solidjs/router";
import { Meta, Title } from "@solidjs/meta";
import { Show } from "solid-js";

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
        /^\/(admin|manage|settings|sign-in|submit|confirm|registration|unsubscribe|payment)(\/|$)/.test(
            location.pathname,
        ) || location.pathname === "/jobs/submit";
    const url = () => `${site.url}${location.pathname}`;
    const title = () => (props.isHome ? site.name : `${props.title} | ${site.name}`);
    const image = () => props.image ?? `${site.url}/og.png`;

    return (
        <>
            <Title>{title()}</Title>
            <Show when={isPrivate()}>
                <Meta name="robots" content="noindex, nofollow" />
            </Show>
            <Meta name="description" content={props.description} />
            <Meta property="og:title" content={title()} />
            <Meta property="og:description" content={props.description} />
            <Meta property="og:url" content={url()} />
            <Meta property="og:site_name" content={site.name} />
            <Meta property="og:type" content={props.isArticle ? "article" : "website"} />
            <Meta property="og:locale" content="en_GB" />
            <Meta name="twitter:card" content="summary_large_image" />
            <Meta name="twitter:title" content={title()} />
            <Meta name="twitter:description" content={props.description} />
            <Meta property="og:image" content={image()} />
            <Meta property="og:image:alt" content={props.title} />
            <Meta name="twitter:image" content={image()} />
        </>
    );
}
