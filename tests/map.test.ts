import { expect, test } from "bun:test";
import { groupLocations, type LocatedOrganisation } from "../convex/places/grouping";
import { clusterLocations } from "../src/map/clusters";

/** Create a public office record for grouping scenarios. */
function office(id: string, line1 = "Baslerstrasse 77"): LocatedOrganisation {
    return {
        id,
        name: id,
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

test("nearby locations split when zoomed in without changing geographic coordinates", () => {
    const locations = [
        { id: "one", latitude: 0, longitude: 0 },
        { id: "two", latitude: 0, longitude: 1 },
        { id: "three", latitude: 2, longitude: 4 },
    ];
    const distant = clusterLocations(locations, (place) => ({
        x: place.longitude * 100,
        y: place.latitude * 100,
    }));
    expect(distant.map((group) => group.map((place) => place.id))).toEqual([
        ["one", "two"],
        ["three"],
    ]);
    expect(
        clusterLocations(locations, (place) => ({
            x: place.longitude * 300,
            y: place.latitude * 300,
        })),
    ).toHaveLength(3);
    expect(locations[1].longitude).toBe(1);
});
