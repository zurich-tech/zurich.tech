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
    // contextual actions use only the signed-in member's own companies
    const access = await owner.query(api.auth.queries.current, {});
    expect(access.ownedOrganisationIds).toEqual([id]);
    expect((await backend.run((ctx) => ctx.db.get(id)))?.ownerId).toBe(access.memberId);

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

test("editing context isolates ownership for members and administrators", async () => {
    const backend = convexTest(schema, modules);
    const ids = await backend.run(async (ctx) => {
        const ids = [];
        for (const name of ["owner", "other", "admin"]) {
            const memberId = await member(ctx, { name, searchText: name, visibility: "private" });
            await ctx.db.insert("accounts", {
                authId: name,
                memberId,
                status: "active",
                isAdmin: name === "admin",
                isTeam: false,
                createdAt: 1,
                updatedAt: 1,
            });
            ids.push(memberId);
        }
        return ids;
    });
    const company = await backend
        .withIdentity({ subject: "owner" })
        .mutation(api.organisations.mutations.upsertCompany, {
            name: "Company",
            slug: "company",
            website: "https://example.org",
            location: "Zurich",
            description: "Research",
            kind: "company",
        });

    // ownership stays scoped even when administrative authority is broader
    for (const [index, name] of ["owner", "other", "admin"].entries()) {
        const access = await backend
            .withIdentity({ subject: name })
            .query(api.auth.queries.current, {});
        expect({
            memberId: access.memberId,
            isAdmin: access.isAdmin,
            companies: access.ownedOrganisationIds,
        }).toEqual({
            memberId: ids[index]!,
            isAdmin: name === "admin",
            companies: name === "owner" ? [company] : [],
        });
    }
    await expect(backend.query(api.auth.queries.current, {})).rejects.toThrow("Sign in required.");
});
