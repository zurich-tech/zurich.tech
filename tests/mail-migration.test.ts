import { convexTest, schema, modules } from "./backend";
import { expect, test } from "bun:test";
import { makeFunctionReference } from "convex/server";

const copy = makeFunctionReference<"mutation">("migrations/mail:copy");

test("email migration preserves history, consent and pauses and can be repeated", async () => {
    const previous = process.env.MAIL_RECIPIENTS;
    process.env.MAIL_RECIPIENTS = "test@example.invalid";
    try {
        const backend = convexTest(schema, modules);
        await backend.run(async (ctx) => {
            await ctx.db.insert("digests", {
                isPaused: true,
                lastWeek: "2026-09-07",
            });
            await ctx.db.insert("subscriptions", {
                email: "test@example.invalid",
                status: "suppressed",
                token: "unchanged",
                createdAt: 1,
                updatedAt: 2,
            });
            for (const status of ["sent", "queued", "failed", "skipped"] as const)
                await ctx.db.insert("deliveries", {
                    key: status,
                    to: "test@example.invalid",
                    subject: "Historical subject",
                    text: "Exact original text",
                    html: "<p>Exact original HTML</p>",
                    status,
                    attempts: status === "failed" ? 3 : 1,
                    createdAt: 5,
                    category: "weekly",
                    providerId: status === "sent" ? "provider-id" : undefined,
                });
            await ctx.db.insert("mailEvents", {
                providerEventId: "signed-id",
                providerId: "provider-id",
                type: "bounced",
                bounceType: "Permanent",
                receivedAt: 6,
            });
        });
        expect((await backend.mutation(copy, {})).copied).toBe(4);
        expect((await backend.mutation(copy, {})).copied).toBe(0);
        await backend.run(async (ctx) => {
            const old = await ctx.db.query("deliveries").collect();
            const messages = await ctx.db.query("messages").collect();
            expect(old.length).toBe(messages.length);
            for (const original of old) {
                const result = messages.find((row) => row.key === original.key)!;
                expect(result.text).toBe(original.text);
                expect(result.html).toBe(original.html);
                expect(result.providerId).toBe(original.providerId);
                expect(result.attempts).toBe(original.attempts);
                expect(result.status).toBe(
                    original.status === "sent"
                        ? "accepted"
                        : original.status === "failed"
                          ? "queued"
                          : original.status,
                );
            }
            expect((await ctx.db.query("subscriptions").first())?.status).toBe("suppressed");
            expect((await ctx.db.query("mailPolicy").first())?.isPaused).toBe(true);
            expect((await ctx.db.query("mailSchedules").first())?.isPaused).toBe(true);
            expect((await ctx.db.query("mailSchedules").first())?.lastWeek).toBe("2026-09-07");
            expect(await ctx.db.query("deliveryEvents").collect()).toHaveLength(1);
            expect(await ctx.db.system.query("_scheduled_functions").collect()).toHaveLength(0);
        });
    } finally {
        if (previous === undefined) delete process.env.MAIL_RECIPIENTS;
        else process.env.MAIL_RECIPIENTS = previous;
    }
});
