import { query } from "@solidjs/router";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

import { publicClient } from "../auth/convex";
import type { CalendarEntry } from "../events/queries";

/** One public member with optional profile records. */
export type PublicMember = FunctionReturnType<typeof api.members.queries.membersList>[number] & {
    /** Events published by this member. */
    hostedEvents?: CalendarEntry[];
    /** Whether the member publicly identifies as a current patron. */
    isPatron?: boolean;
};

/** One resolved public handle. */
export type PublicHandle = NonNullable<FunctionReturnType<typeof api.members.queries.handle>>;

/** Read public member profiles. */
export const getMembers = query(
    async () => await publicClient().query(api.members.queries.membersList, {}),
    "members",
);

/** Read one public member profile. */
export const getMember = query(
    async (handle: string) => await publicClient().query(api.members.queries.member, { handle }),
    "member",
);

/** Resolve one public handle. */
export const getHandle = query(
    async (handle: string) => await publicClient().query(api.members.queries.handle, { handle }),
    "handle",
);

/** Curated team profiles and their community roles. */
export const getTeam = query(
    async () => await publicClient().query(api.members.team.list, {}),
    "team",
);
