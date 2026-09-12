import { query } from "@solidjs/router";

import { api } from "../../convex/_generated/api";

import { publicClient } from "../auth/convex";

/** Active personal sponsors who opted into the sponsor wall. */
export const getPersonalSponsors = query(
    async () => await publicClient().query(api.sponsorships.members.list, {}),
    "personalSponsors",
);

/** Active public sponsors. */
export const getSponsors = query(
    async () => await publicClient().query(api.sponsorships.organisations.list, {}),
    "sponsors",
);
