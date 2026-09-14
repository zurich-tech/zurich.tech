/** A geocoded place ready for a venue field. */
export interface Place {
    /** Venue and postal address. */
    label: string;
    /** Structured postal address for organisation locations. */
    address: { line1: string; locality: string; postalCode?: string; countryCode: string };
    /** Latitude in degrees. */
    latitude: number;
    /** Longitude in degrees. */
    longitude: number;
}

/** Search places and addresses, preferring results near Zurich. */
export async function searchPlaces(text: string, signal: AbortSignal): Promise<Place[]> {
    // request a short suggestion list from Photon’s OpenStreetMap index
    const query = new URLSearchParams({ q: text, limit: "5", lat: "47.3769", lon: "8.5417" });
    const response = await fetch(`https://photon.komoot.io/api/?${query}`, { signal });
    if (!response.ok) throw new Error("Address search is unavailable.");
    const result = await response.json();

    // retain names and street numbers without repeating identical address parts
    const places: Place[] = result.features.map(
        (feature: {
            geometry: { coordinates: [number, number] };
            properties: {
                name?: string;
                street?: string;
                housenumber?: string;
                postcode?: string;
                city?: string;
                locality?: string;
                country?: string;
                countrycode?: string;
            };
        }) => {
            const place = feature.properties;
            const street = [place.street, place.housenumber].filter(Boolean).join(" ");
            const city = [place.postcode, place.city ?? place.locality].filter(Boolean).join(" ");
            const parts = [
                street || place.name,
                city,
                place.countrycode === "CH" ? undefined : place.country,
            ].filter(Boolean);

            return {
                label: [...new Set(parts)].join(", "),
                address: {
                    line1: street || place.name || "",
                    locality: place.city ?? place.locality ?? "",
                    postalCode: place.postcode,
                    countryCode: place.countrycode?.toUpperCase() ?? "",
                },
                longitude: feature.geometry.coordinates[0],
                latitude: feature.geometry.coordinates[1],
            };
        },
    );

    // collapse repeated points for the same postal address
    return places.filter(
        (place, index) => places.findIndex((other) => other.label === place.label) === index,
    );
}
