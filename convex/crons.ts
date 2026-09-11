import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/** Schedule the digest hourly so Zürich daylight saving is handled at runtime. */
const crons = cronJobs();
crons.hourly("weekly programme", { minuteUTC: 0 }, internal.mail.digests.tick, {});
crons.hourly("expired verification limits", { minuteUTC: 15 }, internal.mail.limits.expire, {});
export default crons;
