import { expect, test } from "bun:test";
import { makeFunctionReference } from "convex/server";
import { convexTest, schema, modules } from "./backend";

/** Exercise only isolated databases, never deployment functions. */
const apply = makeFunctionReference<"mutation">("organisations/imports:apply");
const enrich = makeFunctionReference<"mutation">("organisations/imports:enrich");
const logos = makeFunctionReference<"mutation">("organisations/imports:logos");

/** Seed a university, an existing institute and a fully reviewed distinct institute. */
async function fixture() {
    const backend = convexTest(schema, modules);
    const peers = await backend.run(async (ctx) => {
        const peers = [];
        for (const [slug, name, kind, website] of [
            ["university", "University", "university", "https://www.university.example/"],
            ["existing-lab", "Existing Lab", "lab", "https://www.university.example/labs/existing"],
        ] as const) {
            const id = await ctx.db.insert("organisations", {
                slug,
                name,
                kind,
                website,
                description: "Research",
                location: "Winterthur",
                mapLogoUrl: "/logos/university.png",
                updatedAt: 1,
            });
            peers.push({ id, slug, name, website });
        }

        return peers;
    });
    const parent = peers[0]!;
    const website = "https://www.university.example/labs/new";
    const row = {
        slug: "new-lab",
        name: "New Lab",
        kind: "lab" as const,
        website,
        headline: "Robotics research",
        description: "Develops robots.",
        location: "Winterthur",
        office: "Institute contact address",
        sources: [website],
        address: {
            line1: "Technikumstrasse 5",
            postalCode: "8401",
            locality: "Winterthur",
            countryCode: "CH",
            latitude: 47.497643,
            longitude: 8.731291,
            source: "https://api3.geo.admin.ch/building",
        },
        instituteReview: {
            parentId: parent.id,
            parentSlug: parent.slug,
            parentName: parent.name,
            parentWebsite: parent.website,
            peers,
            reason: "Distinct institute with its own research team.",
            sources: [website],
            parentMapLogoUrl: "/logos/university.png",
        },
    };

    return { backend, row, peers };
}

/** Read every table that this import can modify. */
async function snapshot(backend: ReturnType<typeof convexTest>) {
    return backend.run(async (ctx) => ({
        organisations: await ctx.db.query("organisations").collect(),
        addresses: await ctx.db.query("addresses").collect(),
        locations: await ctx.db.query("locations").collect(),
        links: await ctx.db.query("links").collect(),
    }));
}

test("test_import_distinct_institutes_with_exact_parent_branding_in_both_orders", async () => {
    for (const reverse of [false, true]) {
        const { backend, row } = await fixture();
        const website = "https://www.university.example/labs/second";
        const second = {
            ...row,
            name: "Second Lab",
            slug: "second-lab",
            website,
            instituteReview: { ...row.instituteReview, sources: [website] },
        };
        const organisations = reverse ? [second, row] : [row, second];
        const before = await snapshot(backend);
        expect(await backend.mutation(apply, { apply: false, organisations })).toEqual({
            applied: false,
            count: 2,
            slugs: organisations.map((item) => item.slug),
        });
        expect(await snapshot(backend)).toEqual(before);
        expect(await backend.mutation(apply, { apply: true, organisations })).toEqual({
            applied: true,
            count: 2,
            slugs: organisations.map((item) => item.slug),
        });
        const after = await snapshot(backend);
        expect(after.organisations.slice(0, 2)).toEqual(before.organisations);
        expect(
            after.organisations
                .slice(2)
                .map(({ _id, _creationTime, updatedAt, ...fields }) => fields),
        ).toEqual(
            organisations.map(({ office, sources, address, instituteReview, ...fields }) => ({
                ...fields,
                mapLogoUrl: "/logos/university.png",
            })),
        );
        expect(after.addresses).toHaveLength(1);
        const { _id, _creationTime, createdAt, updatedAt, ...address } = after.addresses[0]!;
        const { source, ...expectedAddress } = row.address;
        expect(address).toEqual(expectedAddress);
        expect(
            after.locations.map(({ name, addressId, visibility }) => ({
                name,
                addressId,
                visibility,
            })),
        ).toEqual(
            organisations.map((item) => ({
                name: item.office,
                addressId: _id,
                visibility: "public",
            })),
        );
        expect(after.links).toEqual([]);
    }
});

test("test_reject_stale_parent_peer_and_branding_reviews_without_writes", async () => {
    for (const change of [
        "parent-name",
        "parent-slug",
        "parent-website",
        "parent-kind",
        "parent-delete",
        "parent-logo",
        "peer-name",
        "peer-website",
        "peer-delete",
        "peer-add",
    ] as const) {
        const { backend, row, peers } = await fixture();
        await backend.run(async (ctx) => {
            const parentId = peers[0]!.id;
            const peerId = peers[1]!.id;
            if (change === "parent-delete") await ctx.db.delete(parentId);
            else if (change === "parent-name") await ctx.db.patch(parentId, { name: "Renamed" });
            else if (change === "parent-slug") await ctx.db.patch(parentId, { slug: "renamed" });
            else if (change === "parent-website")
                await ctx.db.patch(parentId, { website: "https://university.example/" });
            else if (change === "parent-kind") await ctx.db.patch(parentId, { kind: "company" });
            else if (change === "parent-logo")
                await ctx.db.patch(parentId, { mapLogoUrl: "/logos/new.png" });
            else if (change === "peer-name") await ctx.db.patch(peerId, { name: "Renamed" });
            else if (change === "peer-website")
                await ctx.db.patch(peerId, {
                    website: "https://www.university.example/labs/renamed",
                });
            else if (change === "peer-delete") await ctx.db.delete(peerId);
            else
                await ctx.db.insert("organisations", {
                    name: "Additional",
                    slug: "additional",
                    kind: "lab",
                    website: "https://www.university.example/labs/additional",
                    location: "Winterthur",
                    description: "Research",
                    updatedAt: 1,
                });
        });
        const before = await snapshot(backend);
        const message =
            change === "parent-logo"
                ? "Institute parent logo changed or conflicts: new-lab."
                : change.startsWith("parent-")
                  ? "Institute parent changed: new-lab."
                  : "Institute host peers changed: new-lab.";
        for (const isApply of [false, true]) {
            await expect(
                backend.mutation(apply, { apply: isApply, organisations: [row] }),
            ).rejects.toThrow(message);
            expect(await snapshot(backend)).toEqual(before);
        }
    }
});

test("test_reject_invalid_institute_scope_evidence_and_peer_sets", async () => {
    const { backend, row } = await fixture();
    const invalid = [
        { ...row, kind: "company" },
        { ...row, website: row.instituteReview.parentWebsite },
        { ...row, website: "https://university.example.evil.test/labs/new" },
        { ...row, website: `${row.website}?institute=new` },
        { ...row, website: `${row.website}#new` },
        { ...row, instituteReview: { ...row.instituteReview, reason: " " } },
        { ...row, instituteReview: { ...row.instituteReview, sources: [] } },
    ];
    for (const candidate of invalid) {
        for (const isApply of [false, true])
            await expect(
                backend.mutation(apply, { apply: isApply, organisations: [candidate] }),
            ).rejects.toThrow("Invalid institute review: new-lab.");
    }
    for (const peers of [[], [row.instituteReview.peers[0], row.instituteReview.peers[0]]]) {
        for (const isApply of [false, true])
            await expect(
                backend.mutation(apply, {
                    apply: isApply,
                    organisations: [{ ...row, instituteReview: { ...row.instituteReview, peers } }],
                }),
            ).rejects.toThrow("Institute host peers changed: new-lab.");
    }
    for (const isApply of [false, true]) {
        await expect(
            backend.mutation(apply, {
                apply: isApply,
                organisations: [
                    {
                        ...row,
                        instituteReview: {
                            ...row.instituteReview,
                            sources: [row.instituteReview.parentWebsite],
                        },
                    },
                ],
            }),
        ).rejects.toThrow("Institute primary page is required: new-lab.");
        await expect(
            backend.mutation(apply, {
                apply: isApply,
                organisations: [{ ...row, mapLogoUrl: "/logos/unrelated.png" }],
            }),
        ).rejects.toThrow("Institute parent logo changed or conflicts: new-lab.");
    }
    expect((await snapshot(backend)).addresses).toEqual([]);
});

test("test_preserve_full_url_name_slug_and_unreviewed_host_duplicate_guards", async () => {
    for (const collision of [
        { website: "http://university.example/labs/existing/" },
        { name: "Existing Lab AG" },
        { slug: "existing-lab" },
    ]) {
        const { backend, row } = await fixture();
        const candidate = {
            ...row,
            ...collision,
            instituteReview: {
                ...row.instituteReview,
                sources: [collision.website ?? row.website],
            },
        };
        for (const isApply of [false, true])
            await expect(
                backend.mutation(apply, { apply: isApply, organisations: [candidate] }),
            ).rejects.toThrow(`Possible duplicate organisation: ${candidate.name}.`);
        expect((await snapshot(backend)).addresses).toEqual([]);
    }
    const { backend, row } = await fixture();
    const { instituteReview, ...ordinary } = row;
    for (const isApply of [false, true]) {
        await expect(
            backend.mutation(apply, { apply: isApply, organisations: [ordinary] }),
        ).rejects.toThrow("Possible duplicate organisation: New Lab.");
        await expect(
            backend.mutation(apply, {
                apply: isApply,
                organisations: [row, { ...row, name: "Alias", slug: "alias" }],
            }),
        ).rejects.toThrow("Possible duplicate organisation: Alias.");
    }
    expect((await snapshot(backend)).addresses).toEqual([]);
});

test("test_allow_reviewed_subdomains_but_reject_unreviewed_batch_peers_in_any_order", async () => {
    for (const reverse of [false, true]) {
        const { backend, row } = await fixture();
        const website = "https://robotics.university.example/";
        const institute = {
            ...row,
            website,
            instituteReview: { ...row.instituteReview, peers: [], sources: [website] },
        };
        const ordinary = {
            ...row,
            name: "Other",
            slug: "other",
            website: `${website}other`,
            instituteReview: undefined,
        };
        const organisations = reverse ? [ordinary, institute] : [institute, ordinary];
        const before = await snapshot(backend);
        for (const isApply of [false, true]) {
            await expect(
                backend.mutation(apply, { apply: isApply, organisations }),
            ).rejects.toThrow("Possible duplicate organisation: New Lab.");
            expect(await snapshot(backend)).toEqual(before);
        }
        await backend.mutation(apply, { apply: true, organisations: [institute] });
        expect((await snapshot(backend)).organisations).toHaveLength(3);
    }
});

test("test_enrich_and_logo_updates_require_full_website_identity", async () => {
    for (const mutation of [enrich, logos]) {
        const { backend, peers } = await fixture();
        await backend.run((ctx) => ctx.db.patch(peers[1]!.id, { mapLogoUrl: undefined }));
        const before = await snapshot(backend);
        const input =
            mutation === enrich
                ? {
                      socials: { github: "https://github.com/existing" },
                      sources: [peers[1]!.website],
                  }
                : {
                      mapLogoUrl: `https://media.zurich.tech/organisations/existing-lab/${"a".repeat(64)}.png`,
                      source: peers[1]!.website,
                  };
        for (const isApply of [false, true]) {
            await expect(
                backend.mutation(mutation, {
                    apply: isApply,
                    organisations: [
                        {
                            ...input,
                            slug: "existing-lab",
                            website: "https://www.university.example/labs/different",
                        },
                    ],
                }),
            ).rejects.toThrow("Organisation identity changed: existing-lab.");
            expect(await snapshot(backend)).toEqual(before);
        }
        await backend.mutation(mutation, {
            apply: true,
            organisations: [
                {
                    ...input,
                    slug: "existing-lab",
                    website: "http://university.example/labs/existing/",
                },
            ],
        });
    }
});

test("test_retain_address_and_branding_guards_for_reviewed_institutes", async () => {
    const { backend, row, peers } = await fixture();
    const addressId = await backend.run(async (ctx) => {
        const { source, ...fields } = row.address;
        const id = await ctx.db.insert("addresses", { ...fields, createdAt: 1, updatedAt: 1 });
        await ctx.db.insert("locations", {
            ownerId: peers[0]!.id,
            addressId: id,
            visibility: "private",
            name: "Private",
        });

        return id;
    });
    const { address, ...profile } = row;
    const { parentMapLogoUrl, ...reviewWithoutLogo } = row.instituteReview;
    const before = await snapshot(backend);
    for (const isApply of [false, true]) {
        await expect(
            backend.mutation(apply, { apply: isApply, organisations: [{ ...profile, addressId }] }),
        ).rejects.toThrow("A public geocoded organisation address is required: New Lab.");
        await expect(
            backend.mutation(apply, {
                apply: isApply,
                organisations: [{ ...row, address: { ...address, latitude: 0 } }],
            }),
        ).rejects.toThrow("Invalid reviewed Swiss address: New Lab.");
        await expect(
            backend.mutation(apply, {
                apply: isApply,
                organisations: [
                    {
                        ...row,
                        instituteReview: reviewWithoutLogo,
                        mapLogoUrl: "/logos/university.png",
                    },
                ],
            }),
        ).rejects.toThrow("Expected a reviewed hosted logo: new-lab.");
        await expect(
            backend.mutation(apply, {
                apply: isApply,
                organisations: [{ ...row, topics: ["missing"] }],
            }),
        ).rejects.toThrow("Choose an available topic: missing.");
        expect(await snapshot(backend)).toEqual(before);
    }

    // retain the ordinary slug-owned asset path when parent branding was not selected
    const mapLogoUrl = `https://media.zurich.tech/organisations/new-lab/${"a".repeat(64)}.png`;
    await backend.mutation(apply, {
        apply: true,
        organisations: [{ ...row, instituteReview: reviewWithoutLogo, mapLogoUrl }],
    });
    expect((await snapshot(backend)).organisations.at(-1)!.mapLogoUrl).toBe(mapLogoUrl);
});
