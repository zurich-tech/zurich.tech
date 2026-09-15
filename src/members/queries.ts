import { publicQuery } from "../data/query";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

import type { CalendarEntry } from "../events/queries";

/** One public member with optional profile records. */
export type PublicMember = FunctionReturnType<typeof api.members.queries.membersList>[number] & {
    /** Events published by this member. */
    hostedEvents?: CalendarEntry[];
    /** Public personal sponsorship level. */
    sponsorTier?: "friend";
};

/** One resolved public handle. */
export type PublicHandle = NonNullable<FunctionReturnType<typeof api.members.queries.handle>>;

/** Read public member profiles. */
export const getMembers = publicQuery(api.members.queries.membersList, "members", () => ({}));

/** Read one public member profile. */
export const getMember = publicQuery(api.members.queries.member, "member", (handle: string) => ({
    handle,
}));

/** Resolve one public handle. */
export const getHandle = publicQuery(api.members.queries.handle, "handle", (handle: string) => ({
    handle,
}));

/** Read curated team profiles and their community roles. */
export const getTeam = publicQuery(api.members.team.list, "team", () => ({}));
