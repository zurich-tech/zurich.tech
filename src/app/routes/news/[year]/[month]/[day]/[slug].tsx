import Article from "../../../[slug]";
import { getArticle, getHeadlines } from "../../../../../../news/queries";

/** Preload the same public records as the legacy route without re-exported route metadata. */
export const route = {
    preload: ({ params }: { params: Record<string, string> }) => {
        getArticle(params.slug);
        getHeadlines();
    },
};

/** Render the shared article at its immutable dated address. */
export default function Route() {
    return <Article />;
}
