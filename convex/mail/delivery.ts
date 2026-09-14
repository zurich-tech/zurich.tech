import { v } from "convex/values";
import { query } from "../_generated/server";
import { recipientsLocked, requireRecipient } from "./policy";
import { normalizeEmail } from "../members/emails";

/** Explain sending restrictions without exposing the test recipient list. */
export const status = query({
    args: {},
    handler: () => ({ isTestMode: recipientsLocked() }),
});

/** Check an email-dependent sign-in before the authentication service issues a code. */
export const check = query({
    args: { email: v.string() },
    handler: (_, { email }) => {
        requireRecipient(normalizeEmail(email));
        return null;
    },
});
