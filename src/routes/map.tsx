import { CommunityMap } from "../component/map";
import { Seo } from "../component/seo";

/** Fill the space between navigation and footer with the community map. */
export default function Route() {
    return (
        <>
            <Seo
                title="Community map"
                description="Explore the institutions and sponsors in the zurich.tech community."
            />
            <CommunityMap />
        </>
    );
}
