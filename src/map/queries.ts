import { groupLocations } from "../../convex/places/grouping";
import { publicQuery } from "../data/query";
import { api } from "../../convex/_generated/api";

/** A public geographic address and its organisations. */
export type MapLocation = ReturnType<typeof groupLocations>[number];

/** Read public organisation locations for both map views. */
export const getMap = publicQuery(api.places.map.map, "map", () => ({}), groupLocations);
