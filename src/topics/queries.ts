import { query } from "@solidjs/router";
import { api } from "../../convex/_generated/api";
import { publicClient } from "../auth/convex";

/** Cache the small public catalogue across forms, filters and labels. */
export const getTopics = query(() => publicClient().query(api.topics.queries.list, {}), "topics");
