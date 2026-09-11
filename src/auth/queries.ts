import { query } from "@solidjs/router";

import { api } from "../../convex/_generated/api";

import { publicClient } from "./convex";

/** Show only sign-in providers configured for this deployment. */
export const getSignInProviders = query(
    async () => await publicClient().query(api.auth.queries.signInProviders, {}),
    "signInProviders",
);
