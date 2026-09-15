import { publicQuery } from "../data/query";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

/** Public job fields. */
export type Job = FunctionReturnType<typeof api.jobs.jobs.list>[number];

/** Read approved public vacancies. */
export const getJobs = publicQuery(
    api.jobs.jobs.list,
    "jobs",
    (organisationId?: Id<"organisations">) => (organisationId ? { organisationId } : {}),
);

/** Read an approved public vacancy. */
export const getJob = publicQuery(api.jobs.jobs.detail, "job", (slug: string) => ({ slug }));
