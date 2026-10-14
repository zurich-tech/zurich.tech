import { expect, test } from "bun:test";
import { makeFunctionReference } from "convex/server";
import { correctCoordinates } from "../convex/organisations/locations";
import { convexTest, schema, modules, member } from "./backend";

/** Internal CLI entry point, without regenerating the shared API declarations. */
const correct = makeFunctionReference<"mutation">("organisations/locations:correctCoordinates");

test("test_preview_and_apply_only_reviewed_coordinates", async () => {
    // preserve every stored field except coordinates and the address modification timestamp
    const { backend, row } = await fixture();
    const before = await snapshot(backend);
    expect(correctCoordinates.isInternal).toBe(true);
    expect(await backend.mutation(correct, { apply: false, corrections: [row] })).toEqual({
        applied: false,
        count: 1,
        locationCount: 2,
        addressIds: [row.addressId],
    });
    expect(await snapshot(backend)).toEqual(before);
    expect(await backend.mutation(correct, { apply: true, corrections: [row] })).toEqual({
        applied: true,
        count: 1,
        locationCount: 2,
        addressIds: [row.addressId],
    });
    const after = await snapshot(backend);
    expect(after.addresses[0].updatedAt).toBeGreaterThan(before.addresses[0].updatedAt);
    expect(after).toEqual({
        ...before,
        addresses: [
            { ...before.addresses[0], ...row.coordinates, updatedAt: after.addresses[0].updatedAt },
        ],
    });

    // applying the same reviewed snapshot twice must fail, not silently become a no-op
    await expect(backend.mutation(correct, { apply: true, corrections: [row] })).rejects.toThrow(
        `Reviewed address changed or is missing: ${row.addressId}.`,
    );
    expect(await snapshot(backend)).toEqual(after);
});

test("test_reject_stale_address_fields_in_both_modes", async () => {
    // reject metadata drift as well as even small coordinate changes
    for (const changed of [
        { latitude: 47.3896476 },
        { longitude: 8.5148337 },
        { latitude: undefined },
        { line1: "Technoparkstrasse 2" },
        { line2: undefined },
        { label: "Changed" },
        { postalCode: "8004" },
        { locality: "Winterthur" },
        { countryCode: "DE" },
        { region: undefined },
    ]) {
        const { backend, row } = await fixture();
        await backend.run((ctx) => ctx.db.patch(row.addressId, changed));
        await rejectBoth(
            backend,
            [row],
            `Reviewed address changed or is missing: ${row.addressId}.`,
        );
    }
    const { backend, row } = await fixture();
    await backend.run((ctx) => ctx.db.delete(row.addressId));
    await rejectBoth(backend, [row], `Reviewed address changed or is missing: ${row.addressId}.`);
});

test("test_reject_private_member_owned_and_stale_public_references", async () => {
    // a complete reviewed reference set cannot hide private consumers or changed ownership
    for (const change of [
        "private",
        "member",
        "owner",
        "name",
        "extra",
        "removed",
        "repointed",
        "organisation",
        "website",
        "deleted-owner",
    ] as const) {
        const { backend, row } = await fixture();
        const reference = row.references[0];
        await backend.run(async (ctx) => {
            if (change === "private")
                await ctx.db.patch(reference.locationId, { visibility: "private" });
            else if (change === "member") {
                const ownerId = await member(ctx, {
                    name: "Member",
                    searchText: "member",
                    visibility: "public",
                });
                await ctx.db.patch(reference.locationId, { ownerId });
            } else if (change === "owner")
                await ctx.db.patch(reference.locationId, {
                    ownerId: row.references[1].organisationId,
                });
            else if (change === "name")
                await ctx.db.patch(reference.locationId, { name: "Office" });
            else if (change === "extra")
                await ctx.db.insert("locations", {
                    addressId: row.addressId,
                    ownerId: reference.organisationId,
                    name: "Private",
                    visibility: "private",
                });
            else if (change === "removed") await ctx.db.delete(reference.locationId);
            else if (change === "repointed") {
                const addressId = await ctx.db.insert("addresses", {
                    ...row.expectedAddress,
                    ...row.expectedCoordinates,
                    createdAt: 1,
                    updatedAt: 1,
                });
                await ctx.db.patch(reference.locationId, { addressId });
            } else if (change === "organisation")
                await ctx.db.patch(reference.organisationId, { slug: "changed" });
            else if (change === "website")
                await ctx.db.patch(reference.organisationId, {
                    website: "https://changed.example/",
                });
            else await ctx.db.delete(reference.organisationId);
        });
        const message = ["extra", "removed", "repointed"].includes(change)
            ? `Address references changed: ${row.addressId}.`
            : ["organisation", "website", "deleted-owner"].includes(change)
              ? `Reviewed organisation changed: ${row.addressId}.`
              : `Public organisation reference changed: ${row.addressId}.`;
        await rejectBoth(backend, [row], message);
    }
});

test("test_reject_any_shared_venue_even_when_paused", async () => {
    // venue consumers are excluded entirely, never copied or patched by this mutation
    for (const status of ["active", "paused"] as const) {
        const { backend, row } = await fixture();
        await backend.run((ctx) =>
            ctx.db.insert("venues", {
                addressId: row.addressId,
                name: "Venue",
                status,
                createdAt: 1,
                updatedAt: 1,
            }),
        );
        await rejectBoth(backend, [row], `Address is shared with a venue: ${row.addressId}.`);
    }
});

test("test_require_complete_distinct_bounded_reviewed_targets", async () => {
    const { backend, row } = await fixture();
    await rejectBoth(backend, [], "Correct between 1 and 100 reviewed addresses.");
    await rejectBoth(
        backend,
        Array(101).fill(row),
        "Correct between 1 and 100 reviewed addresses.",
    );
    await rejectBoth(backend, [row, row], "Reviewed addresses must be distinct.");
    await rejectBoth(
        backend,
        [{ ...row, references: [] }],
        `Provide between 1 and 100 public references: ${row.addressId}.`,
    );
    await rejectBoth(
        backend,
        [{ ...row, references: Array(101).fill(row.references[0]) }],
        `Provide between 1 and 100 public references: ${row.addressId}.`,
    );
    await rejectBoth(
        backend,
        [{ ...row, references: [row.references[0], row.references[0]] }],
        `Reviewed references must be distinct: ${row.addressId}.`,
    );
    await rejectBoth(
        backend,
        [{ ...row, references: [row.references[0]] }],
        `Address references changed: ${row.addressId}.`,
    );
    await rejectBoth(
        backend,
        [{ ...row, coordinates: row.expectedCoordinates }],
        `Coordinates are unchanged: ${row.addressId}.`,
    );
});

test("test_reject_invalid_swiss_coordinates_and_missing_primary_sources", async () => {
    const { backend, row } = await fixture();
    for (const field of ["coordinates", "expectedCoordinates"] as const) {
        for (const invalid of [
            { latitude: NaN },
            { longitude: Infinity },
            { latitude: -Infinity },
            { latitude: 45.79 },
            { latitude: 47.91 },
            { longitude: 5.89 },
            { longitude: 10.61 },
        ]) {
            await rejectBoth(
                backend,
                [{ ...row, [field]: { ...row[field], ...invalid } }],
                `Invalid Swiss coordinates: ${row.addressId}.`,
            );
        }
    }
    for (const corporateSourceUrls of [[], Array(11).fill("https://company.example/contact")])
        await rejectBoth(
            backend,
            [{ ...row, corporateSourceUrls }],
            `Provide between 1 and 10 primary corporate URLs: ${row.addressId}.`,
        );
    await rejectBoth(
        backend,
        [{ ...row, corporateSourceUrls: ["not a URL"] }],
        "Enter a valid HTTP or HTTPS URL.",
    );
    await rejectBoth(
        backend,
        [{ ...row, corporateSourceUrls: ["ftp://company.example/contact"] }],
        "Use an HTTP or HTTPS URL.",
    );
    await rejectBoth(
        backend,
        [{ ...row, corporateSourceUrls: ["https://user:secret@company.example/contact"] }],
        `Source URLs must not contain credentials: ${row.addressId}.`,
    );
    for (const federalSourceUrl of [
        "https://api3.geo.admin.ch.evil.example/rest/services/ech/MapServer/ch.swisstopo.amtliches-gebaeudeadressverzeichnis/100002773",
        "http://api3.geo.admin.ch/rest/services/ech/MapServer/ch.swisstopo.amtliches-gebaeudeadressverzeichnis/100002773",
        "https://api3.geo.admin.ch/rest/services/ech/SearchServer",
        "https://user@api3.geo.admin.ch/rest/services/ech/MapServer/ch.swisstopo.amtliches-gebaeudeadressverzeichnis/100002773",
    ])
        await rejectBoth(
            backend,
            [{ ...row, federalSourceUrl }],
            `A federal building-address source is required: ${row.addressId}.`,
        );
});

test("test_validate_the_entire_batch_before_writing", async () => {
    // a valid first address cannot change when a later target fails review preconditions
    const { backend, row } = await fixture();
    const second = await backend.run(async (ctx) => {
        const addressId = await ctx.db.insert("addresses", {
            ...row.expectedAddress,
            ...row.expectedCoordinates,
            createdAt: 1,
            updatedAt: 1,
        });
        const locationId = await ctx.db.insert("locations", {
            addressId,
            ownerId: row.references[0].organisationId,
            visibility: "public",
            name: "Registered address",
        });

        return {
            ...row,
            addressId,
            references: [{ ...row.references[0], locationId }],
            expectedCoordinates: { ...row.expectedCoordinates, latitude: 47.38 },
        };
    });
    await rejectBoth(
        backend,
        [row, second],
        `Reviewed address changed or is missing: ${second.addressId}.`,
    );
});

/** Seed two public organisations sharing a labelled address with optional fields. */
async function fixture() {
    const backend = convexTest(schema, modules);
    const expectedAddress = {
        label: "Registered address",
        line1: "Technoparkstrasse 1",
        line2: "Room 3",
        postalCode: "8005",
        locality: "Zurich",
        countryCode: "CH" as const,
        region: "ZH",
    };
    const expectedCoordinates = { latitude: 47.3896475, longitude: 8.5148336 };
    const row = await backend.run(async (ctx) => {
        const addressId = await ctx.db.insert("addresses", {
            ...expectedAddress,
            ...expectedCoordinates,
            createdAt: 1,
            updatedAt: 1,
        });
        const references = [];
        for (const slug of ["first", "second"]) {
            const website = `https://${slug}.example/`;
            const organisationId = await ctx.db.insert("organisations", {
                slug,
                name: slug,
                website,
                kind: "company",
                description: "Company",
                location: "Zurich",
                updatedAt: 1,
            });
            const locationName = "Registered address";
            const locationId = await ctx.db.insert("locations", {
                addressId,
                ownerId: organisationId,
                name: locationName,
                visibility: "public",
            });
            references.push({ locationId, locationName, organisationId, slug, website });
        }

        return {
            addressId,
            expectedAddress,
            expectedCoordinates,
            coordinates: { latitude: 47.389779, longitude: 8.516196 },
            federalSourceUrl:
                "https://api3.geo.admin.ch/rest/services/ech/MapServer/ch.swisstopo.amtliches-gebaeudeadressverzeichnis/100002773?sr=4326&geometryFormat=geojson",
            corporateSourceUrls: ["https://www.technopark.ch/"],
            references,
        };
    });

    return { backend, row };
}

/** Read all affected tables to detect unintended writes, creations or deletions. */
async function snapshot(backend: Awaited<ReturnType<typeof fixture>>["backend"]) {
    return backend.run(async (ctx) => ({
        addresses: await ctx.db.query("addresses").collect(),
        locations: await ctx.db.query("locations").collect(),
        organisations: await ctx.db.query("organisations").collect(),
        venues: await ctx.db.query("venues").collect(),
        members: await ctx.db.query("members").collect(),
    }));
}

/** Require the same explicit error and zero writes in preview and application. */
async function rejectBoth(
    backend: Awaited<ReturnType<typeof fixture>>["backend"],
    corrections: unknown[],
    message: string,
) {
    const before = await snapshot(backend);
    for (const apply of [false, true]) {
        await expect(backend.mutation(correct, { apply, corrections })).rejects.toThrow(message);
        expect(await snapshot(backend)).toEqual(before);
    }
}
