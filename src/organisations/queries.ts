import { publicQuery } from "../data/query";

import { api } from "../../convex/_generated/api";

/** Read only series for the programme and series pages. */
export const getSeries = publicQuery(api.organisations.queries.series, "series", () => ({}));

/** Read one public organisation profile by its canonical slug. */
export const getOrganisation = publicQuery(
    api.organisations.queries.detail,
    "organisation",
    (slug: string) => ({ slug }),
);

/** Read the public organisation and series catalogue. */
export const getDirectory = publicQuery(
    api.organisations.queries.directory,
    "directory",
    () => ({}),
);
