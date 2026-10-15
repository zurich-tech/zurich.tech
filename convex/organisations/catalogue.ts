import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { presentProfiles } from "../members/links";

/** Read public directory relationships once, without per-organisation database calls. */
export async function readCatalogue(ctx: QueryCtx) {
    // load each relationship table once and keep private rows out of public projections
    const [organisations, locations, addresses, links] = await Promise.all([
        ctx.db.query("organisations").collect(),
        ctx.db
            .query("locations")
            .filter((q) => q.eq(q.field("visibility"), "public"))
            .collect(),
        ctx.db.query("addresses").collect(),
        ctx.db
            .query("links")
            .filter((q) => q.eq(q.field("visibility"), "public"))
            .collect(),
    ]);
    const addressesById = new Map(addresses.map((address) => [address._id, address]));
    const locationsByOwner = new Map<string, typeof locations>();
    const linksByOwner = new Map<string, Doc<"links">[]>();

    // group public relationships in linear time and preserve link precedence
    for (const location of locations) {
        const rows = locationsByOwner.get(location.ownerId) ?? [];
        rows.push(location);
        locationsByOwner.set(location.ownerId, rows);
    }
    for (const link of links) {
        const rows = linksByOwner.get(link.ownerId) ?? [];
        rows.push(link);
        linksByOwner.set(link.ownerId, rows);
    }
    const profilesByOwner = new Map(
        [...linksByOwner].map(([owner, rows]) => [
            owner,
            presentProfiles(rows.sort((left, right) => left.position - right.position)),
        ]),
    );

    return { organisations, locations, addressesById, locationsByOwner, profilesByOwner };
}
