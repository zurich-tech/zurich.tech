import { groupLocations } from "../../convex/places/grouping";
import { query } from "@solidjs/router";
import { api } from "../../convex/_generated/api";
import { publicClient } from "../auth/convex";

/** A public geographic address and its organisations. */
export type MapLocation = ReturnType<typeof groupLocations>[number];

/** Read public organisation locations for both map views. */
export const getMap = query(
    async () => groupLocations(await publicClient().query(api.places.map.map, {})),
    "map",
);
