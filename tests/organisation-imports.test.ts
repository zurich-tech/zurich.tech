import { expect, test } from "bun:test";
import { makeFunctionReference } from "convex/server";
import { convexTest, schema, modules } from "./backend";

const apply = makeFunctionReference<"mutation">("organisations/imports:apply");
const enrich = makeFunctionReference<"mutation">("organisations/imports:enrich");
const logos = makeFunctionReference<"mutation">("organisations/imports:logos");

/** Seed a reviewed institute with independently reusable parent theme assets. */
async function instituteFixture() {
    const { backend, row } = await fixture();
    const parent = {
        name: "University",
        slug: "university",
        website: "https://university.example/",
        mapLogoUrl: "/logos/university.png",
        mapLogoDarkUrl: "/logos/university-dark.png",
    };
    const id = await backend.run((ctx) =>
        ctx.db.insert("organisations", {
            ...parent,
            kind: "university",
            description: "Research",
            location: "Zurich",
            updatedAt: 1,
        }),
    );
    const website = "https://university.example/labs/new";

    return {
        backend,
        id,
        row: {
            ...row,
            kind: "lab" as const,
            website,
            instituteReview: {
                parentId: id,
                parentSlug: parent.slug,
                parentName: parent.name,
                parentWebsite: parent.website,
                peers: [{ id, slug: parent.slug, name: parent.name, website: parent.website }],
                reason: "Distinct research institute",
                sources: [website],
                parentMapLogoUrl: parent.mapLogoUrl,
                parentMapLogoDarkUrl: parent.mapLogoDarkUrl,
            },
        },
    };
}

test("test_copy_reviewed_parent_dark_logo_with_or_without_light_reuse", async () => {
    for (const reuseLight of [false, true]) {
        for (const explicitDark of [false, true]) {
            const { backend, row } = await instituteFixture();
            const { parentMapLogoUrl, ...darkReview } = row.instituteReview;
            const candidate = {
                ...row,
                instituteReview: reuseLight ? row.instituteReview : darkReview,
                ...(explicitDark ? { mapLogoDarkUrl: darkReview.parentMapLogoDarkUrl } : {}),
            };
            const before = await backend.run((ctx) => ctx.db.query("organisations").collect());
            await backend.mutation(apply, { apply: false, organisations: [candidate] });
            expect(await backend.run((ctx) => ctx.db.query("organisations").collect())).toEqual(
                before,
            );
            await backend.mutation(apply, { apply: true, organisations: [candidate] });
            const saved = await backend.run((ctx) =>
                ctx.db
                    .query("organisations")
                    .withIndex("by_slug", (q) => q.eq("slug", row.slug))
                    .unique(),
            );
            expect(saved?.mapLogoDarkUrl).toBe(darkReview.parentMapLogoDarkUrl);
            expect(saved?.mapLogoUrl).toBe(reuseLight ? parentMapLogoUrl : undefined);
        }
    }
});

test("test_reject_stale_missing_empty_conflicting_and_unreviewed_parent_dark_logos", async () => {
    for (const scenario of ["stale", "missing", "empty", "conflict", "unreviewed"] as const) {
        const { backend, id, row } = await instituteFixture();
        if (scenario === "stale" || scenario === "missing") {
            await backend.run((ctx) =>
                ctx.db.patch(id, {
                    mapLogoDarkUrl: scenario === "stale" ? "/logos/changed.png" : undefined,
                }),
            );
        }
        const { parentMapLogoDarkUrl, ...lightReview } = row.instituteReview;
        const candidate = {
            ...row,
            instituteReview:
                scenario === "unreviewed"
                    ? lightReview
                    : {
                          ...row.instituteReview,
                          parentMapLogoDarkUrl: scenario === "empty" ? "" : parentMapLogoDarkUrl,
                      },
            ...(scenario === "conflict"
                ? {
                      mapLogoDarkUrl: `https://media.zurich.tech/organisations/${row.slug}/${"c".repeat(64)}.png`,
                  }
                : {}),
            ...(scenario === "unreviewed" ? { mapLogoDarkUrl: parentMapLogoDarkUrl } : {}),
        };
        const before = await backend.run(async (ctx) => ({
            organisations: await ctx.db.query("organisations").collect(),
            addresses: await ctx.db.query("addresses").collect(),
            locations: await ctx.db.query("locations").collect(),
        }));
        for (const isApply of [false, true]) {
            await expect(
                backend.mutation(apply, { apply: isApply, organisations: [candidate] }),
            ).rejects.toThrow(
                scenario === "unreviewed"
                    ? `Expected a reviewed hosted logo: ${row.slug}.`
                    : `Institute parent dark logo changed or conflicts: ${row.slug}.`,
            );
            expect(
                await backend.run(async (ctx) => ({
                    organisations: await ctx.db.query("organisations").collect(),
                    addresses: await ctx.db.query("addresses").collect(),
                    locations: await ctx.db.query("locations").collect(),
                })),
            ).toEqual(before);
        }
    }
});

test("test_validate_imported_topics_in_preview_and_apply", async () => {
    const { backend, row } = await fixture();
    await backend.run(async (ctx) => {
        await ctx.db.insert("topics", { slug: "ai", name: "AI", isActive: true });
        await ctx.db.insert("topics", {
            slug: "agents",
            name: "Agents",
            parent: "ai",
            isActive: true,
        });
        await ctx.db.insert("topics", { slug: "community", name: "Community", isActive: false });
    });
    for (const topics of [["missing"], ["community"], ["ai", "ai"]]) {
        for (const isApply of [false, true]) {
            const message =
                topics.length > 1
                    ? "Choose at most 12 distinct topics."
                    : `Choose an available topic: ${topics[0]}.`;
            await expect(
                backend.mutation(apply, { apply: isApply, organisations: [{ ...row, topics }] }),
            ).rejects.toThrow(message);
            expect(
                await backend.run((ctx) => ctx.db.query("organisations").collect()),
            ).toHaveLength(1);
        }
    }
    const organisations = [{ ...row, topics: ["ai"] }];
    for (const isApply of [false, true]) {
        await expect(
            backend.mutation(apply, {
                apply: isApply,
                organisations: [{ ...row, topics: ["ai", "agents"] }],
            }),
        ).rejects.toThrow("Choose specific topics without ancestors: ai.");
    }
    await backend.mutation(apply, { apply: false, organisations });
    expect(await backend.run((ctx) => ctx.db.query("organisations").collect())).toHaveLength(1);
    await backend.mutation(apply, { apply: true, organisations });
    expect(
        (await backend.run((ctx) => ctx.db.query("organisations").collect()))[1]!.topics,
    ).toEqual(["ai"]);
});

/** Independently reviewed Swiss office and its public evidence. */
const reviewedAddress = {
    line1: "Technoparkstrasse 1",
    locality: "Zurich",
    postalCode: "8005",
    countryCode: "CH",
    latitude: 47.39,
    longitude: 8.52,
    source: "https://new.example/contact",
};

test("test_publish_branded_profiles_and_socials_atomically_with_either_address_form", async () => {
    for (const isNewAddress of [false, true]) {
        const { backend, row } = await fixture();
        const { addressId, ...profile } = row;
        const mapLogoUrl = `https://media.zurich.tech/organisations/${row.slug}/${"a".repeat(64)}.png`;
        const mapLogoDarkUrl = `https://media.zurich.tech/organisations/${row.slug}/${"b".repeat(64)}.png`;
        const organisations = [
            {
                ...profile,
                ...(isNewAddress ? { address: reviewedAddress } : { addressId }),
                mapLogoUrl,
                mapLogoDarkUrl,
                socials: {
                    linkedin: "https://linkedin.com/company/new/?utm_source=site",
                    github: "https://github.com/new/",
                    x: "https://twitter.com/new",
                },
            },
        ];
        const before = await backend.run(async (ctx) => ({
            organisations: await ctx.db.query("organisations").collect(),
            addresses: await ctx.db.query("addresses").collect(),
            locations: await ctx.db.query("locations").collect(),
            links: await ctx.db.query("links").collect(),
        }));
        expect(await backend.mutation(apply, { apply: false, organisations })).toEqual({
            applied: false,
            count: 1,
            slugs: [row.slug],
        });
        expect(
            await backend.run(async (ctx) => ({
                organisations: await ctx.db.query("organisations").collect(),
                addresses: await ctx.db.query("addresses").collect(),
                locations: await ctx.db.query("locations").collect(),
                links: await ctx.db.query("links").collect(),
            })),
        ).toEqual(before);

        expect(await backend.mutation(apply, { apply: true, organisations })).toEqual({
            applied: true,
            count: 1,
            slugs: [row.slug],
        });
        const saved = await backend.run(async (ctx) => ({
            organisations: await ctx.db.query("organisations").collect(),
            addresses: await ctx.db.query("addresses").collect(),
            locations: await ctx.db.query("locations").collect(),
            links: await ctx.db.query("links").collect(),
        }));
        const { _id: ownerId, _creationTime, updatedAt, ...stored } = saved.organisations[1]!;
        const { office, sources, ...fields } = profile;
        expect(stored).toEqual({
            ...fields,
            website: "https://new.example/",
            mapLogoUrl,
            mapLogoDarkUrl,
        });
        expect(saved.addresses).toHaveLength(isNewAddress ? 2 : 1);
        expect(saved.locations[1]).toMatchObject({ ownerId, visibility: "public" });
        expect(
            saved.links.map(({ _id, _creationTime, createdAt, updatedAt, ...link }) => link),
        ).toEqual([
            {
                ownerId,
                kind: "linkedin",
                url: "https://www.linkedin.com/company/new",
                position: 1,
                visibility: "public",
            },
            {
                ownerId,
                kind: "github",
                url: "https://github.com/new",
                position: 2,
                visibility: "public",
            },
            { ownerId, kind: "x", url: "https://x.com/new", position: 3, visibility: "public" },
        ]);
    }
});

test("test_reject_bad_import_branding_and_socials_in_preview_and_roll_back_application", async () => {
    for (const invalid of [
        { mapLogoUrl: `https://media.zurich.tech/organisations/wrong/${"a".repeat(64)}.png` },
        { mapLogoUrl: "https://external.example/logo.png" },
        { mapLogoUrl: "" },
        { mapLogoDarkUrl: `https://media.zurich.tech/organisations/wrong/${"b".repeat(64)}.png` },
        { mapLogoDarkUrl: "https://external.example/logo.png" },
        { mapLogoDarkUrl: "" },
        { socials: { linkedin: "https://linkedin.com/in/someone" } },
        { socials: { github: "https://github.com/new/repository" } },
        { socials: { x: "https://x.com/share" } },
    ]) {
        const { backend, row } = await fixture();
        const { addressId, ...profile } = row;
        const before = await backend.run(async (ctx) => ({
            organisations: await ctx.db.query("organisations").collect(),
            addresses: await ctx.db.query("addresses").collect(),
            locations: await ctx.db.query("locations").collect(),
            links: await ctx.db.query("links").collect(),
        }));
        const message =
            "mapLogoUrl" in invalid || "mapLogoDarkUrl" in invalid
                ? "Expected a reviewed hosted logo: second."
                : `Invalid ${Object.keys(invalid.socials)[0]} organisation profile: ${Object.values(invalid.socials)[0]}.`;
        for (const isApply of [false, true]) {
            await expect(
                backend.mutation(apply, {
                    apply: isApply,
                    organisations: [
                        {
                            ...profile,
                            address: reviewedAddress,
                            mapLogoUrl: `https://media.zurich.tech/organisations/${row.slug}/${"a".repeat(64)}.png`,
                            socials: { x: "https://x.com/new" },
                        },
                        {
                            ...profile,
                            address: { ...reviewedAddress, line1: "Another 2" },
                            name: "Second",
                            slug: "second",
                            website: "https://second.example",
                            ...invalid,
                        },
                    ],
                }),
            ).rejects.toThrow(message);
            expect(
                await backend.run(async (ctx) => ({
                    organisations: await ctx.db.query("organisations").collect(),
                    addresses: await ctx.db.query("addresses").collect(),
                    locations: await ctx.db.query("locations").collect(),
                    links: await ctx.db.query("links").collect(),
                })),
            ).toEqual(before);
        }
    }
});

test("test_bind_hosted_logos_to_the_reviewed_slug_in_preview_and_application", async () => {
    const { backend } = await fixture();
    const before = await backend.run((ctx) => ctx.db.query("organisations").collect());
    for (const isApply of [false, true]) {
        await expect(
            backend.mutation(logos, {
                apply: isApply,
                organisations: [
                    {
                        slug: "existing",
                        website: "https://existing.example",
                        source: "https://existing.example/icon.png",
                        mapLogoUrl: `https://media.zurich.tech/organisations/another/${"a".repeat(64)}.png`,
                    },
                ],
            }),
        ).rejects.toThrow("Expected a reviewed hosted logo: existing.");
        expect(await backend.run((ctx) => ctx.db.query("organisations").collect())).toEqual(before);
    }
});

test("test_create_reviewed_investor_offices_and_share_new_batch_addresses", async () => {
    const { backend, row } = await fixture();
    const { addressId, ...profile } = row;
    const organisations = [
        { ...profile, kind: "investor", address: reviewedAddress },
        {
            ...profile,
            name: "Second",
            slug: "second",
            website: "https://second.example",
            address: reviewedAddress,
        },
    ];
    expect(await backend.mutation(apply, { apply: false, organisations })).toEqual({
        applied: false,
        count: 2,
        slugs: ["new-company", "second"],
    });
    expect(await backend.run((ctx) => ctx.db.query("addresses").collect())).toHaveLength(1);
    expect(await backend.mutation(apply, { apply: true, organisations })).toEqual({
        applied: true,
        count: 2,
        slugs: ["new-company", "second"],
    });
    const saved = await backend.run(async (ctx) => ({
        addresses: await ctx.db.query("addresses").collect(),
        locations: await ctx.db.query("locations").collect(),
        organisations: await ctx.db.query("organisations").collect(),
    }));
    expect(saved.addresses).toHaveLength(2);
    const { source, ...address } = reviewedAddress;
    const { _id, _creationTime, createdAt, updatedAt, ...stored } = saved.addresses[1]!;
    expect(stored).toEqual(address);
    expect(saved.locations.slice(1).map((location) => location.addressId)).toEqual([_id, _id]);
    expect(saved.organisations[1]!.kind).toBe("investor");
});

test("test_reuse_only_matching_public_organisation_addresses", async () => {
    for (const ownership of [
        "public",
        "private",
        "member",
        "different-postcode",
        "secondary-line",
    ] as const) {
        const { backend, row } = await fixture();
        await backend.run(async (ctx) => {
            await ctx.db.patch(row.addressId, {
                postalCode: ownership === "different-postcode" ? "8004" : "8005",
                line2: ownership === "secondary-line" ? "Suite 2" : undefined,
            });
            const location = (await ctx.db.query("locations").first())!;
            if (ownership === "private")
                await ctx.db.patch(location._id, { visibility: "private" });
            if (ownership === "member") {
                const ownerId = await ctx.db.insert("members", {
                    name: "Member",
                    searchText: "member",
                    visibility: "public",
                    status: "active",
                    createdAt: 1,
                    updatedAt: 1,
                });
                await ctx.db.patch(location._id, { ownerId });
            }
        });
        const original = await backend.run((ctx) => ctx.db.get(row.addressId));
        const { addressId, ...profile } = row;
        const organisations = [
            {
                ...profile,
                address: {
                    ...reviewedAddress,
                    line1: "  TECHNOPARKSTRASSE   1 ",
                    locality: " ZURICH ",
                },
            },
        ];
        await backend.mutation(apply, { apply: false, organisations });
        await backend.mutation(apply, { apply: true, organisations });
        const addresses = await backend.run((ctx) => ctx.db.query("addresses").collect());
        const locations = await backend.run((ctx) => ctx.db.query("locations").collect());
        expect(addresses).toHaveLength(ownership === "public" ? 1 : 2);
        expect(locations[1]!.addressId === addressId).toBe(ownership === "public");
        expect(await backend.run((ctx) => ctx.db.get(addressId))).toEqual(original);
    }
});

test("test_reject_invalid_reviewed_addresses_equally_without_partial_writes", async () => {
    for (const invalid of [
        { line1: " " },
        { locality: " " },
        { postalCode: "800" },
        { countryCode: "DE" },
        { latitude: NaN },
        { longitude: Infinity },
        { latitude: 45 },
        { latitude: 48 },
        { longitude: 5 },
        { longitude: 11 },
        { source: "" },
        { source: "ftp://new.example/contact" },
    ]) {
        const { backend, row } = await fixture();
        const { addressId, ...profile } = row;
        const before = await backend.run(async (ctx) => ({
            addresses: await ctx.db.query("addresses").collect(),
            organisations: await ctx.db.query("organisations").collect(),
            locations: await ctx.db.query("locations").collect(),
        }));
        for (const isApply of [false, true]) {
            const message =
                "source" in invalid
                    ? invalid.source === ""
                        ? "Enter a valid HTTP or HTTPS URL."
                        : "Use an HTTP or HTTPS URL."
                    : "Invalid reviewed Swiss address: Another.";
            await expect(
                backend.mutation(apply, {
                    apply: isApply,
                    organisations: [
                        { ...profile, address: reviewedAddress },
                        {
                            ...profile,
                            name: "Another",
                            slug: "another",
                            website: "https://another.example",
                            address: { ...reviewedAddress, ...invalid },
                        },
                    ],
                }),
            ).rejects.toThrow(message);
            expect(
                await backend.run(async (ctx) => ({
                    addresses: await ctx.db.query("addresses").collect(),
                    organisations: await ctx.db.query("organisations").collect(),
                    locations: await ctx.db.query("locations").collect(),
                })),
            ).toEqual(before);
        }
    }
});

test("test_require_exactly_one_address_input_and_explicit_evidence", async () => {
    const { backend, row } = await fixture();
    const { addressId, ...profile } = row;
    const { source, ...address } = reviewedAddress;
    for (const candidate of [
        profile,
        { ...row, address: reviewedAddress },
        { ...profile, address },
    ]) {
        for (const isApply of [false, true]) {
            await expect(
                backend.mutation(apply, { apply: isApply, organisations: [candidate] }),
            ).rejects.toThrow();
        }
    }
    expect(await backend.run((ctx) => ctx.db.query("addresses").collect())).toHaveLength(1);
});

test("test_reject_new_address_duplicates_without_leaving_orphan_addresses", async () => {
    for (const collision of [
        { name: "NEW COMPANY AG" },
        { website: "http://www.new.example/path" },
        { slug: "new-company" },
    ]) {
        const { backend, row } = await fixture();
        const { addressId, ...profile } = row;
        for (const isApply of [false, true]) {
            await expect(
                backend.mutation(apply, {
                    apply: isApply,
                    organisations: [
                        { ...profile, address: reviewedAddress },
                        {
                            ...profile,
                            name: "Second",
                            slug: "second",
                            website: "https://second.example",
                            ...collision,
                            address: { ...reviewedAddress, line1: "Another 2" },
                        },
                    ],
                }),
            ).rejects.toThrow("Possible duplicate organisation:");
            expect(await backend.run((ctx) => ctx.db.query("addresses").collect())).toHaveLength(1);
            expect(
                await backend.run((ctx) => ctx.db.query("organisations").collect()),
            ).toHaveLength(1);
            expect(await backend.run((ctx) => ctx.db.query("locations").collect())).toHaveLength(1);
        }
    }
});

test("test_reject_invalid_stored_coordinates_and_country_in_both_address_forms", async () => {
    for (const invalid of [
        { countryCode: "DE" },
        { latitude: NaN },
        { longitude: Infinity },
        { latitude: 0 },
        { longitude: 0 },
    ]) {
        const { backend, row } = await fixture();
        await backend.run((ctx) => ctx.db.patch(row.addressId, { postalCode: "8005", ...invalid }));
        const { addressId, ...profile } = row;
        // a different country is a distinct full address, not a reusable match
        const candidates =
            "countryCode" in invalid ? [row] : [row, { ...profile, address: reviewedAddress }];
        for (const candidate of candidates) {
            for (const isApply of [false, true]) {
                await expect(
                    backend.mutation(apply, { apply: isApply, organisations: [candidate] }),
                ).rejects.toThrow(
                    "A public geocoded organisation address is required: New Company.",
                );
            }
        }
        expect(await backend.run((ctx) => ctx.db.query("addresses").collect())).toHaveLength(1);
    }
});

test("test_preview_and_attach_hosted_logos_without_overwriting_branding", async () => {
    const { backend } = await fixture();
    const row = {
        slug: "existing",
        website: "https://existing.example",
        source: "https://existing.example/icon.png",
        mapLogoUrl: `https://media.zurich.tech/organisations/existing/${"a".repeat(64)}.png`,
    };
    expect(await backend.mutation(logos, { apply: false, organisations: [row] })).toEqual({
        applied: false,
        count: 1,
    });
    expect(
        (await backend.run((ctx) => ctx.db.query("organisations").first()))?.mapLogoUrl,
    ).toBeUndefined();
    await expect(
        backend.mutation(logos, {
            apply: true,
            organisations: [{ ...row, mapLogoUrl: "https://external.example/logo.png" }],
        }),
    ).rejects.toThrow("Expected a reviewed hosted logo: existing.");
    await expect(
        backend.mutation(logos, {
            apply: true,
            organisations: [{ ...row, website: "https://wrong.example" }],
        }),
    ).rejects.toThrow("Organisation identity changed: existing.");
    expect(await backend.mutation(logos, { apply: true, organisations: [row] })).toEqual({
        applied: true,
        count: 1,
    });
    expect((await backend.run((ctx) => ctx.db.query("organisations").first()))?.mapLogoUrl).toBe(
        row.mapLogoUrl,
    );
    await expect(backend.mutation(logos, { apply: true, organisations: [row] })).rejects.toThrow(
        "Organisation already has a logo: existing.",
    );
});

test("test_enrich_social_links_without_replacing_curated_destinations", async () => {
    const { backend } = await fixture();
    const organisations = [
        {
            slug: "existing",
            website: "https://existing.example",
            socials: {
                linkedin: "https://linkedin.com/company/example/?utm_source=site",
                x: "https://twitter.com/example",
            },
            sources: ["https://existing.example"],
        },
    ];
    expect(await backend.mutation(enrich, { apply: false, organisations })).toEqual({
        applied: false,
        added: 2,
        unchanged: 0,
    });
    expect(await backend.run((ctx) => ctx.db.query("links").collect())).toHaveLength(0);
    expect(await backend.mutation(enrich, { apply: true, organisations })).toEqual({
        applied: true,
        added: 2,
        unchanged: 0,
    });
    expect(await backend.mutation(enrich, { apply: true, organisations })).toEqual({
        applied: true,
        added: 0,
        unchanged: 2,
    });
    expect(
        (await backend.run((ctx) => ctx.db.query("links").collect())).map((row) => ({
            kind: row.kind,
            url: row.url,
        })),
    ).toEqual([
        { kind: "linkedin", url: "https://www.linkedin.com/company/example" },
        { kind: "x", url: "https://x.com/example" },
    ]);
    await expect(
        backend.mutation(enrich, {
            apply: true,
            organisations: [{ ...organisations[0], socials: { x: "https://x.com/different" } }],
        }),
    ).rejects.toThrow("Existing x link differs: existing.");
    await expect(
        backend.mutation(enrich, {
            apply: true,
            organisations: [{ ...organisations[0], website: "https://another.example" }],
        }),
    ).rejects.toThrow("Organisation identity changed: existing.");
});

test("test_import_and_enrich_linkedin_organisation_profiles_with_canonical_urls", async () => {
    for (const path of ["company/example", "school/example", "showcase/tx-ventures-vc"]) {
        const { backend, row } = await fixture();
        const socials = { linkedin: `https://ch.linkedin.com/${path}/?utm_source=site#about` };
        const organisations = [{ ...row, socials }];
        await backend.mutation(apply, { apply: false, organisations });
        expect(await backend.run((ctx) => ctx.db.query("links").collect())).toEqual([]);
        await backend.mutation(apply, { apply: true, organisations });
        expect(
            (await backend.run((ctx) => ctx.db.query("links").collect())).map(
                ({ kind, url, visibility }) => ({ kind, url, visibility }),
            ),
        ).toEqual([
            { kind: "linkedin", url: `https://www.linkedin.com/${path}`, visibility: "public" },
        ]);

        // accept the exact official URL and recognise an existing canonical destination
        const enrichment = [
            {
                slug: "existing",
                website: "https://existing.example",
                socials: { linkedin: `https://www.linkedin.com/${path}/` },
                sources: ["https://existing.example"],
            },
        ];
        expect(await backend.mutation(enrich, { apply: false, organisations: enrichment })).toEqual(
            {
                applied: false,
                added: 1,
                unchanged: 0,
            },
        );
        expect(await backend.run((ctx) => ctx.db.query("links").collect())).toHaveLength(1);
        expect(await backend.mutation(enrich, { apply: true, organisations: enrichment })).toEqual({
            applied: true,
            added: 1,
            unchanged: 0,
        });
        expect(await backend.mutation(enrich, { apply: true, organisations: enrichment })).toEqual({
            applied: true,
            added: 0,
            unchanged: 1,
        });
    }
});

test("test_reject_non_organisation_linkedin_paths_and_lookalike_hosts", async () => {
    const { backend, row } = await fixture();
    for (const linkedin of [
        "https://www.linkedin.com/in/someone",
        "https://www.linkedin.com/staff/someone",
        "https://www.linkedin.com/profiles/someone",
        "https://www.linkedin.com/showcase/",
        "https://www.linkedin.com/showcase/tx-ventures-vc/posts",
        "https://www.linkedin.com/company/example/people",
        "https://notlinkedin.com/showcase/tx-ventures-vc",
        "https://linkedin.com.example.org/showcase/tx-ventures-vc",
        "https://linkedin.com@example.org/showcase/tx-ventures-vc",
    ]) {
        for (const isApply of [false, true]) {
            for (const mutation of [apply, enrich]) {
                const organisation =
                    mutation === apply
                        ? { ...row, socials: { linkedin } }
                        : {
                              slug: "existing",
                              website: "https://existing.example",
                              socials: { linkedin },
                              sources: ["https://existing.example"],
                          };
                await expect(
                    backend.mutation(mutation, {
                        apply: isApply,
                        organisations: [organisation],
                    }),
                ).rejects.toThrow(`Invalid linkedin organisation profile: ${linkedin}.`);
            }
        }
    }
    expect(await backend.run((ctx) => ctx.db.query("links").collect())).toEqual([]);
    expect(await backend.run((ctx) => ctx.db.query("organisations").collect())).toHaveLength(1);
});

test("test_reject_share_links_and_personal_linkedin_profiles", async () => {
    const { backend } = await fixture();
    for (const socials of [
        { linkedin: "https://linkedin.com/in/someone" },
        { x: "https://x.com/share" },
        { github: "https://github.com/example/repo" },
    ]) {
        await expect(
            backend.mutation(enrich, {
                apply: true,
                organisations: [
                    {
                        slug: "existing",
                        website: "https://existing.example",
                        socials,
                        sources: ["https://existing.example"],
                    },
                ],
            }),
        ).rejects.toThrow("organisation profile:");
    }
    expect(await backend.run((ctx) => ctx.db.query("links").collect())).toHaveLength(0);
});

/** Create an existing public office and a reviewed candidate. */
async function fixture() {
    const backend = convexTest(schema, modules);
    const addressId = await backend.run(async (ctx) => {
        const ownerId = await ctx.db.insert("organisations", {
            name: "Existing",
            slug: "existing",
            kind: "company",
            description: "Software",
            website: "https://existing.example",
            location: "Zurich",
            updatedAt: 1,
        });
        const addressId = await ctx.db.insert("addresses", {
            line1: "Technoparkstrasse 1",
            locality: "Zurich",
            countryCode: "CH",
            latitude: 47.39,
            longitude: 8.52,
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.insert("locations", {
            ownerId,
            addressId,
            name: "Office",
            visibility: "public",
        });
        return addressId;
    });
    const row = {
        name: "New Company",
        slug: "new-company",
        kind: "company" as const,
        headline: "Engineering",
        description: "Develops engineering software.",
        website: "https://new.example",
        location: "Zurich",
        addressId,
        office: "Zurich office",
        sources: ["https://source.example"],
    };
    return { backend, row };
}

test("test_preview_then_import_profile_and_map_location_atomically", async () => {
    const { backend, row } = await fixture();
    expect(await backend.mutation(apply, { apply: false, organisations: [row] })).toEqual({
        applied: false,
        count: 1,
        slugs: ["new-company"],
    });
    expect(await backend.run((ctx) => ctx.db.query("organisations").collect())).toHaveLength(1);
    expect(await backend.mutation(apply, { apply: true, organisations: [row] })).toEqual({
        applied: true,
        count: 1,
        slugs: ["new-company"],
    });
    const saved = await backend.run(async (ctx) => ({
        organisations: await ctx.db.query("organisations").collect(),
        locations: await ctx.db.query("locations").collect(),
    }));
    expect(saved.organisations).toHaveLength(2);
    expect(saved.locations).toHaveLength(2);
    expect(saved.locations[1]).toMatchObject({
        ownerId: saved.organisations[1]!._id,
        addressId: row.addressId,
        visibility: "public",
        name: "Zurich office",
    });
    await expect(backend.mutation(apply, { apply: true, organisations: [row] })).rejects.toThrow(
        "Possible duplicate organisation: New Company.",
    );
});

test("test_reject_name_domain_and_slug_collisions_without_partial_writes", async () => {
    for (const collision of [
        { name: "EXISTING AG" },
        { website: "http://www.existing.example/path" },
        { slug: "existing" },
    ]) {
        const { backend, row } = await fixture();
        await expect(
            backend.mutation(apply, {
                apply: true,
                organisations: [
                    row,
                    {
                        ...row,
                        name: "Another",
                        slug: "another",
                        website: "https://another.example",
                        ...collision,
                    },
                ],
            }),
        ).rejects.toThrow("Possible duplicate organisation:");
        expect(await backend.run((ctx) => ctx.db.query("organisations").collect())).toHaveLength(1);
        expect(await backend.run((ctx) => ctx.db.query("locations").collect())).toHaveLength(1);
    }
});

test("test_reject_private_or_unmapped_addresses", async () => {
    for (const isPrivate of [true, false]) {
        const { backend, row } = await fixture();
        await backend.run(async (ctx) => {
            if (isPrivate) {
                const location = await ctx.db.query("locations").first();
                await ctx.db.patch(location!._id, { visibility: "private" });
            } else await ctx.db.patch(row.addressId, { latitude: undefined });
        });
        await expect(
            backend.mutation(apply, { apply: true, organisations: [row] }),
        ).rejects.toThrow("A public geocoded organisation address is required:");
    }
});

test("test_reject_duplicate_rows_in_a_dry_run", async () => {
    const { backend, row } = await fixture();
    await expect(
        backend.mutation(apply, { apply: false, organisations: [row, row] }),
    ).rejects.toThrow("Possible duplicate organisation: New Company.");
});
