import { convexTest, schema, modules, member } from "./backend";
import { expect, test } from "bun:test";
import { api } from "../convex/_generated/api";
import { readCatalogue } from "../convex/organisations/catalogue";

test("test_read_large_catalogue_with_constant_database_calls", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const addressId = await ctx.db.insert("addresses", {
            line1: "Shared campus",
            locality: "Zurich",
            countryCode: "CH",
            latitude: 47.37,
            longitude: 8.54,
            createdAt: 1,
            updatedAt: 1,
        });
        for (let index = 0; index < 2000; index++) {
            const ownerId = await ctx.db.insert("organisations", {
                name: `Organisation ${index}`,
                slug: `organisation-${index}`,
                description: "Develops technology",
                location: "Zurich",
                website: `https://example.org/${index}`,
                kind: "company",
                updatedAt: 1,
            });
            await ctx.db.insert("locations", {
                ownerId,
                addressId,
                name: "Office",
                visibility: "public",
            });
            await ctx.db.insert("links", {
                ownerId,
                kind: "github",
                url: `https://github.com/organisation-${index}`,
                visibility: "public",
                position: 0,
                createdAt: 1,
                updatedAt: 1,
            });
        }
    });

    // enforce constant database fanout instead of relying on the emulator's query limits
    await backend.run(async (ctx) => {
        let queries = 0;
        const db = new Proxy(ctx.db, {
            get(target, key) {
                if (key === "get") throw new Error("Catalogue must not perform per-record reads.");
                if (key === "query")
                    return (...args: Parameters<typeof ctx.db.query>) => {
                        queries++;
                        return target.query(...args);
                    };
                return Reflect.get(target, key);
            },
        });
        const catalogue = await readCatalogue({ ...ctx, db });
        expect(queries).toBe(4);
        expect(catalogue.organisations.length).toBe(2000);
    });

    const directory = await backend.query(api.organisations.queries.directory, {});
    const markers = await backend.query(api.places.map.map, {});
    expect(directory.organisations.length).toBe(2000);
    expect(markers.length).toBe(2000);
    expect(markers.every((marker) => Object.keys(marker.socials).length === 1)).toBe(true);
});

test("test_read_one_organisation_with_only_public_locations", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const organisation = await ctx.db.insert("organisations", {
            name: "Example",
            slug: "example",
            kind: "company",
            description: "Public profile",
            location: "Zurich",
            website: "https://example.org",
            updatedAt: 1,
        });
        const addressId = await ctx.db.insert("addresses", {
            line1: "Public street",
            locality: "Zurich",
            countryCode: "CH",
            latitude: 47.37,
            longitude: 8.54,
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.insert("locations", {
            ownerId: organisation,
            addressId,
            name: "Office",
            visibility: "public",
        });
        await ctx.db.insert("locations", {
            ownerId: organisation,
            addressId,
            name: "Private office",
            visibility: "private",
        });
        for (const visibility of ["public", "private"] as const) {
            await ctx.db.insert("links", {
                ownerId: organisation,
                kind: visibility === "public" ? "github" : "linkedin",
                url:
                    visibility === "public"
                        ? "https://github.com/example"
                        : "https://linkedin.com/company/private",
                visibility,
                position: 0,
                createdAt: 1,
                updatedAt: 1,
            });
        }
    });
    const directory = await backend.query(api.organisations.queries.directory, {});
    const organisation = await backend.query(api.organisations.queries.detail, { slug: "example" });
    expect(organisation).toEqual(directory.organisations[0]);
    expect(organisation!.locations.map((location) => location.name)).toEqual(["Office"]);
    expect(await backend.query(api.organisations.queries.detail, { slug: "missing" })).toBeNull();

    // publish only public destinations and locations on the map
    const markers = await backend.query(api.places.map.map, {});
    expect(
        markers.map(({ website, socials, location }) => ({ website, socials, location })),
    ).toEqual([
        {
            website: "https://example.org",
            socials: { github: "https://github.com/example" },
            location: "Office",
        },
    ]);
});

test("test_read_public_series_without_organisation_records", async () => {
    const backend = convexTest(schema, modules);
    const published = await backend.run(async (ctx) => {
        const fields = { name: "Meetup", description: "Public programme", topics: [] };
        const id = await ctx.db.insert("series", { ...fields, slug: "meetup", status: "active" });
        await ctx.db.insert("series", { ...fields, slug: "proposal", status: "proposed" });
        return ctx.db.get(id);
    });

    const series = await backend.query(api.organisations.queries.series, {});
    const directory = await backend.query(api.organisations.queries.directory, {});
    expect(series).toEqual([{ ...published!, organiser: null, coOrganisers: [] }]);
    expect(series).toEqual(directory.series);
});

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
    // changing a slug moves the indexed public page without leaving the previous lookup alive
    await owner.mutation(api.organisations.mutations.upsertCompany, {
        ...values,
        id,
        slug: "renamed",
        kind: "university",
    });
    expect(await backend.query(api.organisations.queries.detail, { slug: "example" })).toBeNull();
    expect(await backend.query(api.organisations.queries.detail, { slug: "renamed" })).toEqual(
        (await backend.query(api.organisations.queries.directory, {})).organisations[0],
    );
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
