import { query } from "../_generated/server";
import { requireAdmin } from "../auth/access";
import type { Doc } from "../_generated/dataModel";

/** Read private contact records without exposing credentials, tokens or survey answers. */
export const list = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);

        // join the small directory in linear passes rather than one query per member
        const members = await ctx.db.query("members").collect();
        const emails = await ctx.db.query("emails").collect();
        const subscriptions = await ctx.db.query("subscriptions").collect();
        const accounts = await ctx.db.query("accounts").collect();
        const registrations = await ctx.db.query("registrations").collect();
        const accountByMember = new Map(accounts.map((row) => [row.memberId, row]));
        const subscriptionByEmail = new Map(subscriptions.map((row) => [row.email, row]));
        const registrationByEmail = new Map<string, Doc<"registrations">>();
        for (const row of registrations) {
            const previous = registrationByEmail.get(row.email);
            if (!previous || row.createdAt > previous.createdAt)
                registrationByEmail.set(row.email, row);
        }

        // retain secondary addresses and subscriptions that have no account
        const addresses = new Map<string, Set<string>>();
        for (const row of emails) {
            const values = addresses.get(row.memberId) ?? new Set<string>();
            values.add(row.email);
            addresses.set(row.memberId, values);
        }
        for (const row of subscriptions) {
            if (!row.memberId) continue;
            const values = addresses.get(row.memberId) ?? new Set<string>();
            values.add(row.email);
            addresses.set(row.memberId, values);
        }
        for (const row of registrations) {
            if (!row.memberId) continue;
            const values = addresses.get(row.memberId) ?? new Set<string>();
            values.add(row.email);
            addresses.set(row.memberId, values);
        }

        // return only fields needed by the admin grid
        const represented = new Set<string>();
        const rows = members.map((member) => {
            const account = accountByMember.get(member._id);
            const contacts = [...(addresses.get(member._id) ?? [])].sort().map((email) => {
                represented.add(email);
                return contact(email, subscriptionByEmail.get(email));
            });
            return {
                id: String(member._id),
                name:
                    member.name ||
                    contacts
                        .map((contact) => registrationByEmail.get(contact.email)?.name)
                        .find(Boolean) ||
                    "",
                status: member.status as string,
                account: account?.status ?? "none",
                createdAt: member.createdAt,
                source: member.source ?? "",
                contacts,
            };
        });
        for (const row of subscriptions) {
            if (represented.has(row.email)) continue;
            represented.add(row.email);
            rows.push({
                id: String(row._id),
                name: registrationByEmail.get(row.email)?.name ?? "",
                status: "contact",
                account: "none",
                createdAt: row.createdAt,
                source: row.source ?? "",
                contacts: [contact(row.email, row)],
            });
        }
        for (const row of registrationByEmail.values()) {
            if (represented.has(row.email)) continue;
            rows.push({
                id: String(row._id),
                name: row.name,
                status: "contact",
                account: "none",
                createdAt: row.createdAt,
                source: row.source ?? "registration",
                contacts: [contact(row.email, undefined)],
            });
        }

        return rows;
    },
});

/** Describe consent independently from account and event registration status. */
function contact(email: string, subscription: Doc<"subscriptions"> | undefined) {
    return {
        email,
        status: subscription?.status ?? "none",
        weekly: subscription?.status === "subscribed" && subscription.weekly !== false,
    };
}
