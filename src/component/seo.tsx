import { Meta, Title } from "@solidjs/meta";

/** SEO metadata. */
export function Seo(props: { title: string; description: string }) {
    // title
    const title = `${props.title} | zurich.tech`;

    return (
        <>
            <Title>{title}</Title>
            <Meta name="description" content={props.description} />
        </>
    );
}
