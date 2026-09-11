import { CommunityMap } from "../../map/map";
import { Seo } from "../seo";

/** Fill the space between navigation and footer with the map. */
export default function Route() {
    return (
        <>
            <Seo
                title="Map"
                description="Explore the institutions and sponsors in the zurich.tech community."
            />
            <CommunityMap />
        </>
    );
}
