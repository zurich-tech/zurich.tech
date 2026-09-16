import { publicQuery } from "../data/query";
import { api } from "../../convex/_generated/api";

/** Load public community statistics. */
export const getStatistics = publicQuery(
    api.statistics.queries.community,
    "statistics",
    () => ({}),
);

/** Load the public subscriber count independently of detailed statistics. */
export const getSubscriberCount = publicQuery(
    api.statistics.queries.subscribers,
    "subscriberCount",
    () => ({}),
);
