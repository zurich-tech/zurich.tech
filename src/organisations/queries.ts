import { publicQuery } from "../data/query";

import { api } from "../../convex/_generated/api";

/** Read the public organisation and series catalogue. */
export const getDirectory = publicQuery(
    api.organisations.queries.directory,
    "directory",
    () => ({}),
);
