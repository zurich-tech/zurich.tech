import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/** Schedule the digest hourly so Zürich daylight saving is handled at runtime. */
const crons = cronJobs();
crons.hourly("weekly programme", { minuteUTC: 0 }, internal.mail.digests.tick, {});
crons.hourly("expired verification limits", { minuteUTC: 15 }, internal.mail.limits.expire, {});
crons.interval("event reminders", { minutes: 15 }, internal.mail.events.tick, {});
crons.daily(
    "community statistics",
    { hourUTC: 21, minuteUTC: 0 },
    internal.statistics.queries.record,
    {},
);
crons.interval("event confirmation", { minutes: 5 }, internal.events.confirmation.tick, {});
crons.hourly("recurring events", { minuteUTC: 5 }, internal.events.schedules.tick, {});
export default crons;
