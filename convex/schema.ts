import { defineSchema } from "convex/server";
import * as topics from "./topics/schema";
import * as news from "./news/schema";
import * as statistics from "./statistics/schema";
import * as auth from "./auth/schema";
import * as members from "./members/schema";
import * as places from "./places/schema";
import * as events from "./events/schema";
import * as sponsorships from "./sponsorships/schema";
import * as billing from "./billing/schema";
import * as mail from "./mail/schema";
import * as legacyMail from "./migrations/schema";
import * as jobs from "./jobs/schema";
import * as organisations from "./organisations/schema";

/** Assemble the tables owned by each domain. */
export default defineSchema({
    ...topics,
    ...auth,
    ...news,
    ...statistics,
    ...members,
    ...places,
    ...events,
    ...sponsorships,
    ...billing,
    ...mail,
    ...legacyMail,
    ...jobs,
    ...organisations,
});
