import { afterAll, beforeAll, expect, test } from "bun:test";
import { convexTest, schema, modules, member } from "./backend";
import { api, internal } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import { register } from "../convex/events/registrations";

/** Restore the public origin after rendering queued notifications. */
const previousSiteUrl = process.env.SITE_URL;
beforeAll(() => {
    process.env.SITE_URL = "https://zurich.tech";
});
afterAll(() => {
    if (previousSiteUrl === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previousSiteUrl;
});

/** Create a full event with an unapproved applicant and two approved waiting attendees. */
async function setup(admission: "automatic" | "approval" = "automatic") {
    const backend = convexTest(schema, modules);
    const ids = await backend.run(async (ctx) => {
        // grant administrative access through the existing identity harness
        const memberId = await member(ctx, {
            name: "Host",
            searchText: "host",
            visibility: "public",
        });
        await ctx.db.insert("accounts", {
            authId: "host",
            memberId,
            status: "active",
            isAdmin: true,
            isTeam: false,
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.insert("handles", {
            memberId,
            name: "host",
            status: "active",
            createdAt: 1,
            updatedAt: 1,
        });

        // store matching published and editable event fields
        const fields = {
            title: "Waitlist",
            slug: "waitlist",
            description: "Waitlist event",
            location: "Zurich",
            format: "talk" as const,
            topics: [],
            startsAt: Date.now() + 86400000,
            primaryOrganiserId: memberId,
            addressAccess: { kind: "unannounced" as const },
            registration: {
                kind: "native" as const,
                admission,
                capacity: 1,
                overflow: "waitlist" as const,
                questions: [],
            },
        };
        const eventId = await ctx.db.insert("events", {
            ...fields,
            ownerId: memberId,
            status: "scheduled",
            createdAt: 1,
            updatedAt: 1,
        });
        const draftId = await ctx.db.insert("submissions", {
            ...fields,
            ownerId: memberId,
            eventId,
            status: "published",
            updatedAt: 1,
            organisations: [],
            speakers: [],
            agenda: [],
        });

        // insert in reverse queue order to distinguish signup order from database order
        const attendees: Record<string, Doc<"registrations">["_id"]> = {};
        for (const [name, status, createdAt, approvedAt] of [
            ["confirmed", "going", 1, 1],
            ["later", "waitlist", 4, 2],
            ["earlier", "waitlist", 3, 4],
            ["unapproved", "waitlist", 2, undefined],
        ] as const) {
            attendees[name] = await ctx.db.insert("registrations", {
                eventId,
                name,
                email: `${name}@example.invalid`,
                token: name,
                status,
                createdAt,
                approvedAt,
                updatedAt: 1,
            });
        }

        return { eventId, draftId, fields, attendees };
    });

    return { backend, host: backend.withIdentity({ subject: "host" }), ...ids };
}

/** Read complete attendee status and notification destinations for a scenario. */
async function snapshot(backend: Awaited<ReturnType<typeof setup>>["backend"]) {
    return backend.run(async (ctx) => {
        const rows = await ctx.db.query("registrations").collect();
        const messages = await ctx.db.query("messages").collect();

        return {
            statuses: Object.fromEntries(rows.map((row) => [row.name, row.status])),
            messages: messages.map(({ to, subject }) => ({ to, subject })),
        };
    });
}

/** Promote one attendee and capture their queued notification before delivery. */
async function promotion() {
    const scenario = await setup();
    const { backend } = scenario;
    const preview = await backend.query(api.events.registrations.previewCancellation, {
        token: "confirmed",
    });
    await backend.mutation(api.events.registrations.cancel, {
        token: "confirmed",
        receipt: preview.receipt,
    });
    const messages = await backend.run((ctx) => ctx.db.query("messages").collect());
    expect(messages.length).toBe(1);

    return { ...scenario, message: messages[0]! };
}

for (const decision of ["cancel", "rescind", "waitlist"] as const) {
    test(`skip a queued promotion after an organiser chooses ${decision}`, async () => {
        const { backend, host, attendees, message } = await promotion();
        const args = { id: attendees.earlier!, decision };
        const preview = await host.query(api.events.registrations.previewDecision, args);
        await host.mutation(api.events.registrations.decide, { ...args, receipt: preview.receipt });
        expect(await backend.query(internal.mail.messages.read, { id: message._id })).toBeNull();

        // run the real delivery path: obsolete mail must consume no provider attempt
        await backend.action(internal.mail.messages.deliver, { id: message._id });
        const skipped = await backend.run((ctx) => ctx.db.get(message._id));
        expect([skipped!.status, skipped!.attempts]).toEqual(["skipped", 0]);
    }, 2000);
}

test("skip a queued promotion after self cancellation", async () => {
    const { backend, message } = await promotion();
    const preview = await backend.query(api.events.registrations.previewCancellation, {
        token: "earlier",
    });
    await backend.mutation(api.events.registrations.cancel, {
        token: "earlier",
        receipt: preview.receipt,
    });
    expect(await backend.query(internal.mail.messages.read, { id: message._id })).toBeNull();
}, 2000);

for (const change of ["cancelled", "draft", "started", "deleted"] as const) {
    test(`skip a queued promotion when its event is ${change}`, async () => {
        const { backend, eventId, message } = await promotion();
        await backend.run(async (ctx) => {
            if (change === "deleted") await ctx.db.delete(eventId);
            else
                await ctx.db.patch(
                    eventId,
                    change === "started" ? { startsAt: Date.now() - 1 } : { status: change },
                );
        });
        expect(await backend.query(internal.mail.messages.read, { id: message._id })).toBeNull();
    }, 2000);
}

for (const change of ["deleted", "email", "suppressed"] as const) {
    test(`skip a queued promotion when its recipient is ${change}`, async () => {
        const { backend, attendees, message } = await promotion();
        await backend.run(async (ctx) => {
            if (change === "deleted") await ctx.db.delete(attendees.earlier!);
            else if (change === "email")
                await ctx.db.patch(attendees.earlier!, { email: "changed@example.invalid" });
            else
                await ctx.db.insert("subscriptions", {
                    email: message.to,
                    token: "suppression",
                    status: "suppressed",
                    createdAt: 1,
                    updatedAt: 1,
                });
        });
        expect(await backend.query(internal.mail.messages.read, { id: message._id })).toBeNull();
    }, 2000);
}

test("retain eligible promotion mail with registration references and expiry", async () => {
    const { backend, eventId, fields, attendees, message } = await promotion();
    expect({
        eventId: message.eventId,
        registrationId: message.registrationId,
        expiresAt: message.expiresAt,
        category: message.category,
    }).toEqual({
        eventId,
        registrationId: attendees.earlier,
        expiresAt: fields.startsAt,
        category: undefined,
    });
    expect(await backend.query(internal.mail.messages.read, { id: message._id })).toEqual({
        ...message,
        unsubscribeToken: undefined,
    });
}, 2000);

test("skip an expired promotion even if the event was postponed", async () => {
    const { backend, eventId, message } = await promotion();
    await backend.run(async (ctx) => {
        await ctx.db.patch(message._id, { expiresAt: Date.now() - 1 });
        await ctx.db.patch(eventId, { startsAt: Date.now() + 172800000 });
    });
    expect(await backend.query(internal.mail.messages.read, { id: message._id })).toBeNull();
}, 2000);

test("retain event-wide confirmation notices for waitlisted attendees", async () => {
    const { backend, eventId, attendees, message } = await promotion();
    // event confirmation is distinct from an individual attendee's admission
    const id = await backend.run((ctx) =>
        ctx.db.insert("messages", {
            key: "event-confirmation",
            to: "later@example.invalid",
            subject: "Event confirmed",
            text: "The event will happen.",
            category: "confirmed",
            eventId,
            registrationId: attendees.later,
            status: "queued",
            isBulk: false,
            attempts: 0,
            nextAttemptAt: message.createdAt,
            createdAt: message.createdAt,
        }),
    );
    const notification = await backend.run((ctx) => ctx.db.get(id));
    expect(await backend.query(internal.mail.messages.read, { id })).toEqual({
        ...notification!,
        unsubscribeToken: undefined,
    });
}, 2000);

test("retain tentative admission and administrative cancellation notifications", async () => {
    const { backend, host, eventId, attendees } = await setup();
    await backend.run((ctx) =>
        ctx.db.patch(eventId, {
            confirmation: {
                minimum: 1,
                isApprovalRequired: true,
                timing: "deadline",
                decidesAt: Date.now() + 3600000,
            },
        }),
    );
    const args = { id: attendees.confirmed!, decision: "cancel" as const };
    const preview = await host.query(api.events.registrations.previewDecision, args);
    await host.mutation(api.events.registrations.decide, { ...args, receipt: preview.receipt });
    const messages = await backend.run((ctx) => ctx.db.query("messages").collect());
    expect(messages.map(({ to, subject }) => ({ to, subject }))).toEqual([
        { to: "confirmed@example.invalid", subject: "Waitlist: Registration cancelled" },
        { to: "earlier@example.invalid", subject: "Waitlist: Registration received" },
    ]);
    for (const message of messages) {
        expect(await backend.query(internal.mail.messages.read, { id: message._id })).toEqual({
            ...message,
            unsubscribeToken: undefined,
        });
    }
}, 2000);

for (const admission of ["automatic", "approval"] as const) {
    for (const actor of ["self", "admin"] as const) {
        test(`promote the oldest approved attendee after ${actor} cancellation with ${admission} admission`, async () => {
            const { backend, host, attendees } = await setup(admission);
            if (actor === "self") {
                const preview = await backend.query(api.events.registrations.previewCancellation, {
                    token: "confirmed",
                });
                expect([preview.emails, preview.recipients]).toEqual([1, 1]);
                await backend.mutation(api.events.registrations.cancel, {
                    token: "confirmed",
                    receipt: preview.receipt,
                });
                await backend.mutation(api.events.registrations.cancel, {
                    token: "confirmed",
                    receipt: preview.receipt,
                });
            } else {
                const args = { id: attendees.confirmed!, decision: "cancel" as const };
                const preview = await host.query(api.events.registrations.previewDecision, args);
                expect([preview.promotions, preview.emails, preview.recipients]).toEqual([1, 2, 2]);
                await host.mutation(api.events.registrations.decide, {
                    ...args,
                    receipt: preview.receipt,
                });
            }

            expect(await snapshot(backend)).toEqual({
                statuses: {
                    confirmed: "cancelled",
                    later: "waitlist",
                    earlier: "going",
                    unapproved: "waitlist",
                },
                messages: [
                    ...(actor === "admin"
                        ? [
                              {
                                  to: "confirmed@example.invalid",
                                  subject: "Waitlist: Registration cancelled",
                              },
                          ]
                        : []),
                    { to: "earlier@example.invalid", subject: "Waitlist: Registration confirmed" },
                ],
            });
        }, 2000);
    }
}

test("approve a full-event applicant without bypassing capacity", async () => {
    const { backend, host, attendees } = await setup("approval");
    const args = { id: attendees.unapproved!, decision: "approve" as const };
    const preview = await host.query(api.events.registrations.previewDecision, args);
    expect([preview.status, preview.promotions, preview.emails]).toEqual(["waitlist", 0, 1]);
    await host.mutation(api.events.registrations.decide, { ...args, receipt: preview.receipt });

    // the newly approved applicant has the earliest signup timestamp
    const cancellation = await backend.query(api.events.registrations.previewCancellation, {
        token: "confirmed",
    });
    await backend.mutation(api.events.registrations.cancel, {
        token: "confirmed",
        receipt: cancellation.receipt,
    });
    expect(await snapshot(backend)).toEqual({
        statuses: {
            confirmed: "cancelled",
            later: "waitlist",
            earlier: "waitlist",
            unapproved: "going",
        },
        messages: [
            { to: "unapproved@example.invalid", subject: "Waitlist: Registration waitlisted" },
            { to: "unapproved@example.invalid", subject: "Waitlist: Registration confirmed" },
        ],
    });
}, 2000);

for (const capacity of [2, null, 0] as const) {
    test(`apply published capacity ${capacity} without overbooking`, async () => {
        const { backend, host, eventId, draftId, fields } = await setup();
        const proposed = {
            ...fields,
            organisations: [],
            speakers: [],
            agenda: [],
            registration: { ...fields.registration, capacity },
        };
        const preview = await host.query(api.events.actions.preview, {
            id: draftId,
            action: "publish",
            fields: proposed,
        });
        const save = { ...proposed, id: draftId, publish: true, receipt: preview.receipt };

        if (capacity === 0) {
            await expect(host.mutation(api.events.mutations.save, save)).rejects.toThrow(
                "Capacity must be a positive whole number.",
            );
            expect((await backend.run((ctx) => ctx.db.get(eventId)))!.registration).toEqual(
                fields.registration,
            );
            expect((await snapshot(backend)).messages).toEqual([]);
        } else {
            expect([preview.promotions, preview.emails]).toEqual(
                capacity === null ? [2, 2] : [1, 1],
            );
            await host.mutation(api.events.mutations.save, save);
            expect(await snapshot(backend)).toEqual({
                statuses: {
                    confirmed: "going",
                    later: capacity === null ? "going" : "waitlist",
                    earlier: "going",
                    unapproved: "waitlist",
                },
                messages: [
                    { to: "earlier@example.invalid", subject: "Waitlist: Registration confirmed" },
                    ...(capacity === null
                        ? [
                              {
                                  to: "later@example.invalid",
                                  subject: "Waitlist: Registration confirmed",
                              },
                          ]
                        : []),
                ],
            });
        }
    }, 2000);
}

for (const closure of ["deadline", "started", "cancelled", "draft", "tentative"] as const) {
    test(`prevent automatic promotion when the event is ${closure}`, async () => {
        const { backend, host, eventId, fields, attendees } = await setup();
        await backend.run((ctx) =>
            ctx.db.patch(
                eventId,
                closure === "deadline"
                    ? { registration: { ...fields.registration, closesAt: Date.now() - 1 } }
                    : closure === "started"
                      ? { startsAt: Date.now() - 1 }
                      : closure === "tentative"
                        ? {
                              confirmation: {
                                  minimum: 1,
                                  isApprovalRequired: false,
                                  timing: "deadline",
                                  decidesAt: Date.now() - 1,
                              },
                          }
                        : { status: closure },
            ),
        );

        if (closure === "tentative") {
            await expect(
                backend.query(api.events.registrations.previewCancellation, { token: "confirmed" }),
            ).rejects.toThrow("The confirmation deadline has passed. Wait for the event decision.");
            await expect(
                host.query(api.events.registrations.previewDecision, {
                    id: attendees.confirmed!,
                    decision: "cancel",
                }),
            ).rejects.toThrow("The confirmation deadline has passed. Wait for the event decision.");
            expect((await snapshot(backend)).messages).toEqual([]);
        } else {
            if (closure !== "deadline") {
                await expect(
                    backend.query(api.events.registrations.previewCancellation, {
                        token: "confirmed",
                    }),
                ).rejects.toThrow("This event no longer accepts registration changes.");
            }
            const args = { id: attendees.confirmed!, decision: "cancel" as const };
            const preview = await host.query(api.events.registrations.previewDecision, args);
            expect([preview.promotions, preview.emails]).toEqual([0, 1]);
            await host.mutation(api.events.registrations.decide, {
                ...args,
                receipt: preview.receipt,
            });
            expect(await snapshot(backend)).toEqual({
                statuses: {
                    confirmed: "cancelled",
                    later: "waitlist",
                    earlier: "waitlist",
                    unapproved: "waitlist",
                },
                messages: [
                    {
                        to: "confirmed@example.invalid",
                        subject: "Waitlist: Registration cancelled",
                    },
                ],
            });
        }
    }, 2000);
}

test("reject stale cancellation consent after the queue changes", async () => {
    const { backend, attendees } = await setup();
    const preview = await backend.query(api.events.registrations.previewCancellation, {
        token: "confirmed",
    });
    await backend.run((ctx) =>
        ctx.db.patch(attendees.earlier!, { status: "cancelled", updatedAt: 2 }),
    );
    await expect(
        backend.mutation(api.events.registrations.cancel, {
            token: "confirmed",
            receipt: preview.receipt,
        }),
    ).rejects.toThrow("Registration changes are pending. Please review and confirm again.");
    expect(await snapshot(backend)).toEqual({
        statuses: {
            confirmed: "going",
            later: "waitlist",
            earlier: "cancelled",
            unapproved: "waitlist",
        },
        messages: [],
    });
}, 2000);

test("promote suppressed recipients without counting or delivering their notification", async () => {
    const { backend } = await setup();
    await backend.run((ctx) =>
        ctx.db.insert("subscriptions", {
            email: "earlier@example.invalid",
            token: "suppressed",
            status: "suppressed",
            createdAt: 1,
            updatedAt: 1,
        }),
    );
    const preview = await backend.query(api.events.registrations.previewCancellation, {
        token: "confirmed",
    });
    expect([preview.emails, preview.recipients]).toEqual([0, 0]);
    await backend.mutation(api.events.registrations.cancel, {
        token: "confirmed",
        receipt: preview.receipt,
    });
    const messages = await backend.run((ctx) => ctx.db.query("messages").collect());
    expect(messages.length).toBe(1);
    expect(await backend.query(internal.mail.messages.read, { id: messages[0]!._id })).toBeNull();
    expect((await snapshot(backend)).statuses).toEqual({
        confirmed: "cancelled",
        later: "waitlist",
        earlier: "going",
        unapproved: "waitlist",
    });
}, 2000);

test("assign approval only to automatic verified signups", async () => {
    for (const admission of ["automatic", "approval"] as const) {
        const { backend, eventId } = await setup(admission);
        await backend.run((ctx) =>
            register(
                ctx,
                {
                    eventId,
                    email: "new@example.invalid",
                    name: "new",
                    answers: [],
                    token: "new",
                    newsletterToken: "newsletter",
                },
                10,
            ),
        );
        const row = await backend.run((ctx) =>
            ctx.db
                .query("registrations")
                .withIndex("by_token", (range) => range.eq("token", "new"))
                .unique(),
        );
        expect([row!.status, row!.approvedAt]).toEqual(
            admission === "automatic" ? ["waitlist", 10] : ["pending", undefined],
        );
    }
}, 2000);

test("reject capacity below confirmed attendance", async () => {
    const { backend, host, eventId, draftId, fields, attendees } = await setup();
    await backend.run(async (ctx) => {
        await ctx.db.patch(eventId, { registration: { ...fields.registration, capacity: 2 } });
        await ctx.db.patch(attendees.earlier!, { status: "going" });
    });
    const proposed = { ...fields, organisations: [], speakers: [], agenda: [] };
    const preview = await host.query(api.events.actions.preview, {
        id: draftId,
        action: "publish",
        fields: proposed,
    });
    await expect(
        host.mutation(api.events.mutations.save, {
            ...proposed,
            id: draftId,
            publish: true,
            receipt: preview.receipt,
        }),
    ).rejects.toThrow("Capacity is below confirmed attendance.");
    expect((await backend.run((ctx) => ctx.db.get(eventId)))!.registration).toEqual({
        ...fields.registration,
        capacity: 2,
    });
    expect((await snapshot(backend)).messages).toEqual([]);
}, 2000);

test("leave the full event unchanged when a waitlisted attendee cancels", async () => {
    const { backend } = await setup();
    const preview = await backend.query(api.events.registrations.previewCancellation, {
        token: "earlier",
    });
    expect([preview.emails, preview.recipients]).toEqual([0, 0]);
    await backend.mutation(api.events.registrations.cancel, {
        token: "earlier",
        receipt: preview.receipt,
    });
    expect(await snapshot(backend)).toEqual({
        statuses: {
            confirmed: "going",
            later: "waitlist",
            earlier: "cancelled",
            unapproved: "waitlist",
        },
        messages: [],
    });
}, 2000);

test("allow self cancellation after registration closes without promoting", async () => {
    const { backend, eventId, fields } = await setup();
    await backend.run((ctx) =>
        ctx.db.patch(eventId, {
            registration: { ...fields.registration, closesAt: Date.now() - 1 },
        }),
    );
    const preview = await backend.query(api.events.registrations.previewCancellation, {
        token: "confirmed",
    });
    expect([preview.emails, preview.recipients]).toEqual([0, 0]);
    await backend.mutation(api.events.registrations.cancel, {
        token: "confirmed",
        receipt: preview.receipt,
    });
    expect(await snapshot(backend)).toEqual({
        statuses: {
            confirmed: "cancelled",
            later: "waitlist",
            earlier: "waitlist",
            unapproved: "waitlist",
        },
        messages: [],
    });
}, 2000);

test("promote an existing approved queue even when overflow rejects new signups", async () => {
    const { backend, eventId, fields } = await setup();
    await backend.run((ctx) =>
        ctx.db.patch(eventId, { registration: { ...fields.registration, overflow: "closed" } }),
    );
    const preview = await backend.query(api.events.registrations.previewCancellation, {
        token: "confirmed",
    });
    expect([preview.emails, preview.recipients]).toEqual([1, 1]);
    await backend.mutation(api.events.registrations.cancel, {
        token: "confirmed",
        receipt: preview.receipt,
    });
    expect(await snapshot(backend)).toEqual({
        statuses: {
            confirmed: "cancelled",
            later: "waitlist",
            earlier: "going",
            unapproved: "waitlist",
        },
        messages: [{ to: "earlier@example.invalid", subject: "Waitlist: Registration confirmed" }],
    });
}, 2000);

test("defer waitlist promotion until capacity edits are published", async () => {
    const { backend, host, eventId, draftId, fields } = await setup();
    await host.mutation(api.events.mutations.save, {
        ...fields,
        organisations: [],
        speakers: [],
        agenda: [],
        id: draftId,
        publish: false,
        registration: { ...fields.registration, capacity: null },
    });
    expect((await backend.run((ctx) => ctx.db.get(eventId)))!.registration).toEqual(
        fields.registration,
    );
    expect(await snapshot(backend)).toEqual({
        statuses: {
            confirmed: "going",
            later: "waitlist",
            earlier: "waitlist",
            unapproved: "waitlist",
        },
        messages: [],
    });
}, 2000);
