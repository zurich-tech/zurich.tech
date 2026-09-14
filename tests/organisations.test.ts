import { expect, test, mock } from "bun:test";
import { convexTest } from "convex-test";
import type { GenericQueryCtx, GenericDataModel } from "convex/server";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

mock.module("../convex/auth/component", () => ({
    authComponent: {
        getAuthUser: async (ctx: GenericQueryCtx<GenericDataModel>) => {
            const identity = await ctx.auth.getUserIdentity();
            if (!identity) throw new Error("Sign in required.");
            return { _id: identity.subject, email: "test@example.invalid", emailVerified: true };
        },
    },
}));
const modules = Object.fromEntries(
    [...new Bun.Glob("**/*.ts").scanSync({ cwd: "convex" })].map((path) => [
        `../convex/${path}`,
        () => import(`../convex/${path}`),
    ]),
);

test("organisation owners can create and change categories without changing identity", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const memberId = await ctx.db.insert("members", {
            name: "Owner",
            status: "active",
            searchText: "owner",
            visibility: "private",
            createdAt: 1,
            updatedAt: 1,
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
