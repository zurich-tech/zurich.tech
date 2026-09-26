import { filterLocations } from "../src/map/filter";
import { expect, test } from "bun:test";
import { groupLocations, type LocatedOrganisation } from "../convex/places/grouping";
import { arrangeLogos, honeycomb } from "../src/map/placement";

/** Create a public office record for grouping scenarios. */
function office(id: string, line1 = "Baslerstrasse 77"): LocatedOrganisation {
    return {
        id,
        name: id,
        kind: "company",
        slug: id,
        location: "Office",
        prominence: "small",
        latitude: 47.38,
        longitude: 8.5,
        address: { line1, postalCode: "8048", locality: "Zurich", countryCode: "CH" },
    };
}

test("shared offices merge independent address documents and retain every organisation", () => {
    const host = { ...office("host"), prominence: "large" as const };
    host.address.locality = "Zürich";
    const groups = groupLocations([
        office("startup", "  baslerstrasse   77 "),
        host,
        office("startup"),
        office("neighbour", "Baslerstrasse 79"),
    ]);
    expect(groups).toHaveLength(2);
    const shared = groups.find((group) => group.organisations.length === 2)!;
    expect(shared.organisations.map((organisation) => organisation.id)).toEqual([
        "host",
        "startup",
    ]);
    expect(shared.longitude).toBe(8.5);
});

test("separate logos stay put and overlapping logos retain individual anchors", () => {
    const logos = [
        { id: "one", x: 100, y: 100, size: 26 },
        { id: "two", x: 132, y: 100, size: 26 },
    ];
    expect(
        arrangeLogos(logos, { width: 800, height: 600 }).placed.map((logo) => logo.offset),
    ).toEqual([
        [0, 0],
        [0, 0],
    ]);
    const shared = arrangeLogos([...logos, { id: "three", x: 100, y: 100, size: 36 }], {
        width: 800,
        height: 600,
    }).placed;
    expect(shared).toHaveLength(3);
    expect(shared[2].x).toBe(100);
    for (let index = 0; index < shared.length; index++) {
        for (const other of shared.slice(index + 1)) {
            const logo = shared[index];
            expect(
                Math.hypot(
                    logo.x + logo.offset[0] - other.x - other.offset[0],
                    logo.y + logo.offset[1] - other.y - other.offset[1],
                ),
            ).toBeGreaterThanOrEqual((logo.size + other.size) / 2 + 3);
        }
    }
});

test("shared-address filters match category and search on the same organisation", () => {
    const locations = groupLocations([
        { ...office("zurich.tech"), kind: "community" },
        { ...office("Symbol"), kind: "startup" },
    ]);
    expect(filterLocations(locations, "startup", ["zurich.tech"])).toEqual([]);
    const startups = filterLocations(locations, "startup", []);
    expect(startups[0].organisations.map((entry) => entry.name)).toEqual(["Symbol"]);
    expect(filterLocations(locations, "all", ["baslerstrasse"])[0].organisations).toHaveLength(2);
});

test("dense edge placement stays within bounds and accounts for every visible organisation", () => {
    const input = Array.from({ length: 200 }, (_, index) => ({
        id: String(index),
        x: 10,
        y: 10,
        size: index % 2 ? 26 : 36,
    }));
    const result = arrangeLogos(input, { width: 390, height: 474 });
    expect(result.placed.length + result.crowded.length).toBe(200);
    expect(result.crowded.length).toBeGreaterThan(0);
    for (const [index, logo] of result.placed.entries()) {
        const x = logo.x + logo.offset[0];
        const y = logo.y + logo.offset[1];
        expect(x - logo.size / 2).toBeGreaterThanOrEqual(0);
        expect(y - logo.size / 2).toBeGreaterThanOrEqual(0);
        expect(x + logo.size / 2).toBeLessThanOrEqual(390);
        expect(y + logo.size / 2).toBeLessThanOrEqual(474);
        for (const other of result.placed.slice(index + 1)) {
            expect(
                Math.hypot(x - other.x - other.offset[0], y - other.y - other.offset[1]),
            ).toBeGreaterThanOrEqual((logo.size + other.size) / 2 + 3);
        }
    }
    expect(
        arrangeLogos([{ id: "offscreen", x: -100, y: 100, size: 36 }], { width: 390, height: 474 }),
    ).toEqual({ placed: [], crowded: [] });
});

test("honeycomb cells fill rings outwards without any two dots closer than the spacing", () => {
    const cells = Array.from({ length: 61 }, (_, index) => honeycomb(index, 16));

    // assert the centre and the ring each index lands in
    expect(cells[0]).toEqual([0, 0]);
    for (const [index, [x, y]] of cells.entries()) {
        const ring = index === 0 ? 0 : index < 7 ? 1 : index < 19 ? 2 : index < 37 ? 3 : 4;
        expect(Math.hypot(x, y)).toBeLessThanOrEqual(ring * 16 + 1e-9);
        expect(Math.hypot(x, y)).toBeGreaterThanOrEqual(ring * 16 * (Math.sqrt(3) / 2) - 1e-9);
    }

    // assert every pair keeps at least one spacing apart
    for (const [index, [x, y]] of cells.entries())
        for (const [otherX, otherY] of cells.slice(index + 1))
            expect(Math.hypot(x - otherX, y - otherY)).toBeGreaterThanOrEqual(16 - 1e-9);
});
