import { Show, Switch, Match } from "solid-js";
import { Arrow } from "../components/arrow";
import { Card } from "../components/card";
import { DetailList, DetailRow } from "../app/page";
import { VenueMap } from "../map/venue";
import type { PublicEvent } from "./queries";

/** A venue projected for the current viewer by the server. */
export type Venue = PublicEvent["venue"];

/** Explain missing addresses without guessing or exposing a city-wide map. */
export function AddressNotice(props: { venue: Venue }) {
    return (
        <Show when={!props.venue.address}>
            <Switch>
                <Match when={props.venue.availability === "external"}>
                    <a
                        class="address-notice"
                        href={props.venue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        View address on {props.venue.label} <Arrow direction="external" />
                    </a>
                </Match>
                <Match when={props.venue.availability === "confirmed"}>
                    <span>Address shared after registration confirmation.</span>
                </Match>
                <Match when={props.venue.availability === "unannounced"}>
                    <span>Venue to be announced.</span>
                </Match>
            </Switch>
        </Show>
    );
}

/** Use the same venue and arrival details on event and registration pages. */
export function VenueCard(props: { venue: Venue }) {
    return (
        <Card title="Venue" id="venue">
            <DetailList>
                <DetailRow label="Location" value={props.venue.name} />
                <Show when={props.venue.address}>
                    <DetailRow label="Address" value={props.venue.address} />
                </Show>
                <Show when={props.venue.access}>
                    <DetailRow label="Access" value={props.venue.access} />
                </Show>
            </DetailList>
            <AddressNotice venue={props.venue} />
            <Show
                when={props.venue.coordinates}
                fallback={
                    <Show when={props.venue.address}>
                        <a
                            class="text-link venue-search"
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(props.venue.address!)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Directions <Arrow direction="external" />
                        </a>
                    </Show>
                }
            >
                {(coordinates) => (
                    <VenueMap
                        name={props.venue.name || "Event venue"}
                        coordinates={coordinates()}
                    />
                )}
            </Show>
        </Card>
    );
}
