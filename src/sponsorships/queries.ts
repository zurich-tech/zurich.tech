import { query } from "@solidjs/router";

import { api } from "../../convex/_generated/api";

import { publicClient } from "../auth/convex";

/** Active patrons who opted into the sponsor wall. */
export const getPatrons = query(
    async () => await publicClient().query(api.sponsorships.members.list, {}),
    "patrons",
);

/** Active public sponsors. */
export const getSponsors = query(
    async () => await publicClient().query(api.sponsorships.organisations.list, {}),
    "sponsors",
);
