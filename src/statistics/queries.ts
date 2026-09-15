import { publicQuery } from "../data/query";
import { api } from "../../convex/_generated/api";

/** Load public community statistics. */
export const getStatistics = publicQuery(
    api.statistics.queries.community,
    "statistics",
    () => ({}),
);
