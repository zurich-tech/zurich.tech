import { expect, test } from "bun:test";
import { convexTest, schema, modules, member } from "./backend";
import { api } from "../convex/_generated/api";

test("test_save_new_participation_choices_and_report_legacy_volunteers_as_help_out", async () => {
    // retain a legacy volunteer answer alongside a new survey response
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        for (const authId of ["admin", "legacy"]) {
            const memberId = await member(ctx, {
                name: authId,
                searchText: authId,
                visibility: "private",
            });
            await ctx.db.insert("accounts", {
                authId,
                memberId,
                status: "active",
                isAdmin: authId === "admin",
                isTeam: false,
                participation: authId === "legacy" ? ["volunteer"] : [],
                createdAt: 1,
                updatedAt: 1,
            });
        }
    });

    // roundtrip the new choices through the guided survey mutation
    const admin = backend.withIdentity({ subject: "admin" });
    const participation = ["demo", "host", "teach", "volunteer"];
    await admin.mutation(api.members.audience.answer, {
        question: "participation",
        values: participation,
    });
    const answers = await admin.query(api.members.audience.current, {});
    expect(answers.participation).toEqual(participation);
    const legacy = await backend
        .withIdentity({ subject: "legacy" })
        .query(api.members.audience.current, {});
    expect(legacy.participation).toEqual(["volunteer"]);

    // aggregate stored values under the current labels without losing legacy responses
    const report = await admin.query(api.members.audience.report, {});
    expect(report.questions.find((question) => question.field === "participation")).toEqual({
        field: "participation",
        label: "How would you like to get involved?",
        multiple: true,
        responses: 2,
        total: 2,
        withheld: 0,
        groups: [
            { label: "Attend", count: 0, percentage: 0 },
            { label: "Speak", count: 0, percentage: 0 },
            { label: "Demo", count: 1, percentage: 50 },
            { label: "Host", count: 1, percentage: 50 },
            { label: "Teach", count: 1, percentage: 50 },
            { label: "Organise", count: 0, percentage: 0 },
            { label: "Mentor", count: 0, percentage: 0 },
            { label: "Sponsor", count: 0, percentage: 0 },
            { label: "Help out", count: 2, percentage: 100 },
        ],
    });
});
