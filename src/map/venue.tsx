import { Arrow } from "../components/arrow";

/** Show the venue's surroundings and open directions to its exact location. */
export function VenueMap(props: {
    /** Venue name for the embedded map's accessible title. */
    name: string;
    /** Geographic position in degrees. */
    coordinates: { latitude: number; longitude: number };
}) {
    // frame the streets around the building without requiring a map SDK or API key
    const source = () => {
        const { latitude, longitude } = props.coordinates;
        const query = new URLSearchParams({
            bbox: [longitude - 0.006, latitude - 0.004, longitude + 0.006, latitude + 0.004].join(
                ",",
            ),
            layer: "mapnik",
            marker: `${latitude},${longitude}`,
        });

        return `https://www.openstreetmap.org/export/embed.html?${query}`;
    };
    const directions = () => {
        const { latitude, longitude } = props.coordinates;
        const query = new URLSearchParams({ api: "1", destination: `${latitude},${longitude}` });

        return `https://www.google.com/maps/dir/?${query}`;
    };

    return (
        <div class="venue-map">
            <iframe src={source()} title={`Map showing ${props.name}`} loading="lazy" />
            <a class="text-link" href={directions()} target="_blank" rel="noopener noreferrer">
                Directions <Arrow direction="external" />
            </a>
        </div>
    );
}
