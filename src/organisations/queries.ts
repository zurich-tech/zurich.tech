import { query } from "@solidjs/router";

import { api } from "../../convex/_generated/api";

import { publicClient } from "../auth/convex";

/** Read the public organisation and series catalogue. */
export const getDirectory = query(
    async () => await publicClient().query(api.organisations.queries.directory, {}),
    "directory",
);
