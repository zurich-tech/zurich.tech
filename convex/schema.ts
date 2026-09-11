import { defineSchema } from "convex/server";
import * as auth from "./auth/schema";
import * as members from "./members/schema";
import * as places from "./places/schema";
import * as events from "./events/schema";
import * as sponsorships from "./sponsorships/schema";
import * as billing from "./billing/schema";
import * as mail from "./mail/schema";
import * as jobs from "./jobs/schema";
import * as organisations from "./organisations/schema";

/** Assemble the tables owned by each domain. */
export default defineSchema({
    ...auth,
    ...members,
    ...places,
    ...events,
    ...sponsorships,
    ...billing,
    ...mail,
    ...jobs,
    ...organisations,
});
