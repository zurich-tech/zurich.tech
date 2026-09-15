import { publicQuery } from "../data/query";
import { api } from "../../convex/_generated/api";

/** Cache the small public catalogue across forms, filters and labels. */
export const getTopics = publicQuery(api.topics.queries.list, "topics", () => ({}));
