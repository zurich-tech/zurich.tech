import { FacetList } from "../components/facets";
import { site } from "./site";

/** Ways to take part, each leading to its explanation on the contribute page. */
const ways = [
    { label: "Suggest a speaker", href: "/contribute#speakers" },
    { label: "Give a talk", href: "/contribute#talks" },
    { label: "Organise an event", href: "/contribute#events" },
    { label: "Provide a venue", href: "/contribute#venues" },
    { label: "Join the Discord", href: site.socials.discord },
];

/** Invite readers to take part from the sidebar of collection pages. */
export function Contribute() {
    return (
        <FacetList
            title="Take part"
            titleHref="/contribute"
            facets={ways.map((way) => ({
                label: way.label,
                href: way.href,
                meta: way.href.startsWith("http") ? "↗" : "→",
            }))}
        />
    );
}
