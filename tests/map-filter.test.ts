import { expect, spyOn, test } from "bun:test";
import { countTopics, expandTopicFilters, filterLocations } from "../src/map/filter";
import type { MapLocation } from "../src/map/queries";
import { matchesSearch, searchTerms } from "../src/search/search";

test("test_count_topic_ancestors_once_per_organisation_across_offices", () => {
    const places = locations();
    const catalogue = [
        { slug: "technology" },
        { slug: "hardware", parent: "technology" },
        { slug: "robotics", parent: "hardware" },
        { slug: "sensors", parent: "hardware" },
        { slug: "software", parent: "technology" },
        { slug: "empty" },
        { slug: "orphan", parent: "missing" },
    ];

    // overlapping children and direct ancestors count once, even across differing office records
    places[0].organisations[0].topics = ["robotics", "sensors", "hardware", "robotics"];
    places[1].organisations = [
        { ...places[0].organisations[0], topics: ["software", "orphan", "unknown"] },
        places[1].organisations[0],
    ];
    expect(countTopics(places, catalogue)).toEqual({
        technology: 2,
        hardware: 1,
        robotics: 1,
        sensors: 1,
        software: 2,
        empty: 0,
        orphan: 1,
    });

    // the caller supplies matching tenants, not the original unfiltered address groups
    for (const category of ["all", "startup", "company", "university", "unknown"]) {
        for (const query of ["", "alpha", "zug", "zurich beta", "missing"]) {
            const candidates = filterLocations(places, category, searchTerms(query));
            const expected = Object.fromEntries(
                catalogue.map(({ slug }) => {
                    const matches = filterLocations(
                        candidates,
                        "all",
                        [],
                        expandTopicFilters([slug], catalogue),
                    );

                    return [
                        slug,
                        new Set(
                            matches.flatMap((place) =>
                                place.organisations.map((entry) => entry.id),
                            ),
                        ).size,
                    ];
                }),
            );
            expect(countTopics(candidates, catalogue)).toEqual(expected);
        }
    }
});

test("test_refresh_topic_counts_after_in_place_catalogue_and_organisation_changes", () => {
    const places = locations();
    const catalogue: { slug: string; parent?: string }[] = [
        { slug: "hardware" },
        { slug: "robotics", parent: "hardware" },
        { slug: "software" },
    ];
    expect(countTopics(places, catalogue)).toEqual({ hardware: 1, robotics: 1, software: 1 });
    catalogue[1].parent = "software";
    expect(countTopics(places, catalogue)).toEqual({ hardware: 0, robotics: 1, software: 2 });
    places[0].organisations[0].topics = ["hardware"];
    expect(countTopics(places, catalogue)).toEqual({ hardware: 1, robotics: 0, software: 1 });
    expect(countTopics([], catalogue)).toEqual({ hardware: 0, robotics: 0, software: 0 });
    expect(countTopics(places, [])).toEqual({});
});

test("test_reject_topic_cycles_even_without_matching_organisations", () => {
    expect(() => countTopics([], [{ slug: "self", parent: "self" }])).toThrow(
        "Topic hierarchy contains a cycle: self.",
    );
    expect(() =>
        countTopics(
            [],
            [
                { slug: "first", parent: "second" },
                { slug: "second", parent: "first" },
            ],
        ),
    ).toThrow("Topic hierarchy contains a cycle: first.");
});

/** Build independent locations, including multiple tenants and an empty location. */
function locations(): MapLocation[] {
    return [
        {
            id: "shared",
            address: "Zürich, Strasse 1",
            latitude: 47.38,
            longitude: 8.5,
            organisations: [
                {
                    id: "alpha",
                    slug: "alpha",
                    name: "Álpha",
                    headline: "Café robotics",
                    kind: "startup",
                    topics: ["robotics"],
                    location: "Office",
                    prominence: "small",
                },
                {
                    id: "beta",
                    slug: "beta",
                    name: "Beta",
                    kind: "company",
                    topics: ["software"],
                    location: "Office",
                    prominence: "small",
                },
            ],
        },
        {
            id: "other",
            address: "Zug 2",
            latitude: 47.17,
            longitude: 8.51,
            organisations: [
                {
                    id: "gamma",
                    slug: "gamma",
                    name: "Ga\u0301mma",
                    headline: "AI / sensors",
                    kind: "university",
                    location: "Lab",
                    prominence: "large",
                },
            ],
        },
        { id: "empty", address: "", latitude: 0, longitude: 0, organisations: [] },
    ];
}

/** Preserve the original uncached implementation as an independent parity oracle. */
function uncached(
    places: MapLocation[],
    category: string,
    terms: readonly string[],
    topics?: ReadonlySet<string>,
): MapLocation[] {
    if (category === "all" && terms.length === 0 && topics === undefined) return places;

    return places
        .map((place) => {
            const organisations = place.organisations.filter(
                (entry) =>
                    (category === "all" || entry.kind === category) &&
                    (topics === undefined || entry.topics?.some((topic) => topics.has(topic))) &&
                    matchesSearch(
                        [place.address, entry.name, entry.headline ?? ""].join(" "),
                        terms,
                    ),
            );

            return organisations.length === place.organisations.length
                ? place
                : { ...place, organisations };
        })
        .filter((place) => place.organisations.length > 0);
}

test("test_match_uncached_search_across_queries_categories_and_topics", () => {
    const places = locations();
    const queries = [
        "",
        " ",
        "ÁLPHA",
        "cafe robotics",
        "Zürich beta",
        "gamma",
        "sensors",
        "absent",
    ];
    const terms = [
        ...queries.map(searchTerms),
        ["1 alpha"],
        ["alpha cafe"],
        ["ALPHA"],
        [""],
        [" "],
    ];
    const topics = [
        undefined,
        new Set<string>(),
        new Set(["robotics"]),
        new Set(["software", "robotics"]),
    ];

    // repeat the matrix so warmed indexes must preserve the same results
    for (let pass = 0; pass < 2; pass++) {
        for (const category of ["all", "startup", "company", "university", "unknown"]) {
            for (const selected of topics) {
                for (const query of terms) {
                    expect(filterLocations(places, category, query, selected)).toEqual(
                        uncached(places, category, query, selected),
                    );
                }
            }
        }
    }
});

test("test_invalidate_search_fields_and_read_mutated_membership_filters", () => {
    const places = locations();
    const entry = places[0].organisations[0];
    const topics = new Set(["robotics"]);
    filterLocations(places, "all", ["alpha"]);

    // exercise edits without replacing the input array or organisation object
    const edits = [
        () => {
            places[0].address = "Winterthur 3";
        },
        () => {
            entry.name = "Delta";
        },
        () => {
            entry.headline = "Quantum computing";
        },
        () => {
            entry.headline = undefined;
        },
        () => {
            entry.kind = "company";
        },
        () => {
            entry.topics!.splice(0, 1, "software");
        },
        () => {
            topics.clear();
            topics.add("software");
        },
        () => {
            places[0].organisations.reverse();
        },
        () => {
            places[0].organisations.splice(0, 1);
        },
        () => {
            places[0].organisations.push({ ...entry, name: "Replacement" });
        },
        () => {
            places.reverse();
        },
    ];
    for (const edit of edits) {
        edit();
        for (const query of [
            "alpha",
            "delta",
            "quantum",
            "zurich",
            "winterthur",
            "replacement",
            "",
        ]) {
            for (const category of ["all", "startup", "company"]) {
                expect(filterLocations(places, category, searchTerms(query))).toEqual(
                    uncached(places, category, searchTerms(query)),
                );
                expect(filterLocations(places, category, searchTerms(query), topics)).toEqual(
                    uncached(places, category, searchTerms(query), topics),
                );
            }
        }
    }
});

test("test_keep_shared_organisation_objects_correct_across_addresses_and_subsets", () => {
    const places = locations();
    places[1].organisations = [places[0].organisations[0]];

    // an object can appear at several addresses without inheriting the last address's match
    for (const query of ["zurich", "zug", "zurich", "alpha", "zug"]) {
        expect(filterLocations(places, "all", [query])).toEqual(uncached(places, "all", [query]));
    }
    const subset = filterLocations(places, "all", ["alpha"]);
    expect(filterLocations(subset, "all", ["zug"])).toEqual(uncached(subset, "all", ["zug"]));

    // new objects with identical ids must not reuse an older snapshot's text
    const replacement = locations();
    replacement[0].organisations[0].name = "Replacement";
    expect(filterLocations(replacement, "all", ["alpha"])).toEqual([]);
    expect(filterLocations(replacement, "all", ["replacement"])).toEqual(
        uncached(replacement, "all", ["replacement"]),
    );
});

test("test_preserve_collection_place_and_tenant_identity", () => {
    const places = locations();
    expect(filterLocations(places, "all", [])).toBe(places);
    expect(filterLocations(places, "all", ["zurich"])[0]).toBe(places[0]);
    const partial = filterLocations(places, "startup", []);
    expect(partial[0]).not.toBe(places[0]);
    expect(partial[0].organisations[0]).toBe(places[0].organisations[0]);
    expect(places[0].organisations).toHaveLength(2);
    expect(filterLocations(places, "all", [], new Set())).toEqual([]);
});

test("test_fold_once_per_unchanged_tenant_and_skip_empty_searches", () => {
    const places = locations();
    const normalize = spyOn(String.prototype, "normalize");
    try {
        // category and topic filtering need no searchable text
        filterLocations(places, "startup", []);
        filterLocations(places, "all", [], new Set(["robotics"]));
        expect(normalize).toHaveBeenCalledTimes(0);

        // the three original tenants are indexed once across successive keystrokes
        for (const term of ["a", "al", "alp", "alph", "alpha"]) {
            filterLocations(places, "all", [term]);
        }
        expect(normalize).toHaveBeenCalledTimes(3);

        // wrappers may change while unchanged tenant text remains reusable
        filterLocations([...places], "all", ["alpha"]);
        filterLocations([{ ...places[0] }], "all", ["alpha"]);
        expect(normalize).toHaveBeenCalledTimes(3);
        places[0].organisations[0].headline = "Changed";
        filterLocations(places, "all", ["changed"]);
        expect(normalize).toHaveBeenCalledTimes(4);
        places[0].address = "New address";
        filterLocations(places, "all", ["address"]);
        expect(normalize).toHaveBeenCalledTimes(6);
    } finally {
        normalize.mockRestore();
    }
});
