import { publicQuery } from "../data/query";
import { api } from "../../convex/_generated/api";

/** Read active personal sponsors who opted into the sponsor wall. */
export const getPersonalSponsors = publicQuery(
    api.sponsorships.members.list,
    "personalSponsors",
    () => ({}),
);

/** Read active public sponsors. */
export const getSponsors = publicQuery(api.sponsorships.organisations.list, "sponsors", () => ({}));
