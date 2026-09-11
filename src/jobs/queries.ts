import { query } from "@solidjs/router";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { publicClient } from "../auth/convex";

/** Public job fields. */
export type Job = FunctionReturnType<typeof api.jobs.jobs.list>[number];

/** Approved public vacancies. */
export const getJobs = query(
    async (organisationId?: Id<"organisations">) =>
        await publicClient().query(api.jobs.jobs.list, { organisationId }),
    "jobs",
);

/** An approved public vacancy. */
export const getJob = query(
    async (slug: string) => await publicClient().query(api.jobs.jobs.detail, { slug }),
    "job",
);
