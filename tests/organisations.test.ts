import { convexTest, schema, modules, member } from "./backend";
import { expect, test } from "bun:test";
import { api } from "../convex/_generated/api";

test("organisation owners can create and change categories without changing identity", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Owner",
            searchText: "owner",
            visibility: "private",
        });
        await ctx.db.insert("accounts", {
            authId: "owner",
            memberId,
            status: "active",
            isAdmin: false,
            isTeam: false,
            createdAt: 1,
            updatedAt: 1,
        });
    });
    const owner = backend.withIdentity({ subject: "owner" });
    const values = {
        name: "Example",
        slug: "example",
        website: "https://example.org",
        location: "Zurich",
        description: "Research",
    };
    const id = await owner.mutation(api.organisations.mutations.upsertCompany, {
        ...values,
        kind: "startup",
    });
    expect((await backend.run((ctx) => ctx.db.get(id)))?.kind).toBe("startup");
    const saved = await owner.mutation(api.organisations.mutations.upsertCompany, {
        ...values,
        id,
        kind: "university",
    });
    expect(saved).toBe(id);
    expect((await backend.run((ctx) => ctx.db.get(id)))?.kind).toBe("university");
    await expect(
        backend.mutation(api.organisations.mutations.upsertCompany, {
            ...values,
            id,
            kind: "company",
        }),
    ).rejects.toThrow();
});
