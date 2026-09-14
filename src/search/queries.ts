import { query } from "@solidjs/router";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

import type { SearchKind } from "./search";
import { publicClient } from "../auth/convex";

/** One global search result. */
export type SearchResult = FunctionReturnType<typeof api.search.search.search>[number];

/** Search public records. */
export const search = query(
    async (text: string, kinds?: readonly SearchKind[]) =>
        await publicClient().query(api.search.search.search, {
            now: Date.now(),
            text,
            kinds: kinds ? [...kinds] : undefined,
        }),
    "search",
);
