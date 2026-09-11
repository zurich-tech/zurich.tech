import { query } from "@solidjs/router";
import { api } from "../../convex/_generated/api";
import { publicClient } from "../auth/convex";

/** Load public community statistics. */
export const getStatistics = query(
    async () => publicClient().query(api.statistics.queries.community, {}),
    "statistics",
);
