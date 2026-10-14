import { expect, test } from "bun:test";
import { api } from "../convex/_generated/api";
import { descendantTopics } from "../convex/topics/hierarchy";
import { groupLocations, type LocatedOrganisation } from "../convex/places/grouping";
import { filterLocations } from "../src/map/filter";
import { convexTest, schema, modules, member } from "./backend";

test("test_match_topic_descendants_kind_and_search_on_the_same_tenant", () => {
    const hierarchy = [
        { slug: "ai" },
        { slug: "machine-learning", parent: "ai" },
        { slug: "vision", parent: "machine-learning" },
        { slug: "hardware" },
    ];
    const location = {
        location: "Office",
        prominence: "small" as const,
        latitude: 47.38,
        longitude: 8.5,
        address: { line1: "Shared street 1", locality: "Zurich", countryCode: "CH" },
    };
    const tenants: LocatedOrganisation[] = [
        {
            ...location,
            id: "akina",
            slug: "akina",
            name: "Akina",
            kind: "startup",
            topics: ["vision"],
        },
        {
            ...location,
            id: "hardware",
            slug: "hardware",
            name: "Hardware company",
            kind: "company",
            topics: ["hardware"],
        },
        {
            ...location,
            id: "direct",
            slug: "direct",
            name: "Direct AI",
            kind: "company",
            topics: ["ai"],
        },
        { ...location, id: "unknown", slug: "unknown", name: "Unclassified", kind: "startup" },
    ];
    const places = groupLocations(tenants);
    const ai = descendantTopics("ai", hierarchy);
    const expected = (ids: string[]) => [
        {
            ...places[0],
            organisations: places[0].organisations.filter((person) => ids.includes(person.id)),
        },
    ];

    expect(filterLocations(places, "all", [], ai)).toEqual(expected(["akina", "direct"]));
    expect(filterLocations(places, "startup", ["akina"], ai)).toEqual(expected(["akina"]));
    expect(filterLocations(places, "company", ["akina"], ai)).toEqual([]);
    expect(filterLocations(places, "startup", [], descendantTopics("hardware", hierarchy))).toEqual(
        [],
    );
    expect(filterLocations(places, "all", ["hardware"], ai)).toEqual([]);
    expect(filterLocations(places, "all", [], new Set())).toEqual([]);
    expect(filterLocations(places, "all", [])).toEqual(places);
});

test("test_roundtrip_company_topics_through_public_map_and_address_grouping", async () => {
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
        await ctx.db.insert("topics", { slug: "ai", name: "AI", isActive: true });
        await ctx.db.insert("topics", {
            slug: "vision",
            name: "Vision",
            parent: "ai",
            isActive: true,
        });
    });
    const owner = backend.withIdentity({ subject: "owner" });
    const fields = {
        name: "Akina",
        slug: "akina",
        kind: "startup" as const,
        website: "https://example.org",
        location: "Zurich",
        description: "Research",
    };
    const form = new FormData();
    form.append("topic", "vision");
    const topics = form.getAll("topic").map(String);
    const id = await owner.mutation(api.organisations.mutations.upsertCompany, {
        ...fields,
        topics,
    });
    await backend.run(async (ctx) => {
        const addressId = await ctx.db.insert("addresses", {
            line1: "Shared street 1",
            locality: "Zurich",
            countryCode: "CH",
            latitude: 47.38,
            longitude: 8.5,
            createdAt: 1,
            updatedAt: 1,
        });
        for (const visibility of ["public", "private"] as const)
            await ctx.db.insert("locations", {
                ownerId: id,
                addressId,
                name: "Office",
                visibility,
            });
    });

    // retain selected keys through the public query and grouped map projection
    const locations = await backend.query(api.places.map.map, {});
    expect(locations.map((place) => ({ id: place.id, topics: place.topics }))).toEqual([
        { id, topics },
    ]);
    expect(groupLocations(locations)[0].organisations.map((person) => person.topics)).toEqual([
        topics,
    ]);
    expect(
        (await backend.query(api.organisations.queries.detail, { slug: "akina" }))?.topics,
    ).toEqual(topics);

    // an explicit empty editor submission clears the public classification
    await owner.mutation(api.organisations.mutations.upsertCompany, { ...fields, id, topics: [] });
    expect((await backend.query(api.places.map.map, {})).map((place) => place.topics)).toEqual([
        [],
    ]);
});
