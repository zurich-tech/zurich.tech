/** Event assignments remain independent of team content access and public organiser credits. */
export type Role = "editor" | "organiser";
export type Scope = { kind: "event" | "series"; id: string };
export type Grant = { role: Role; scope: Scope };
export type Access = { isAdmin: boolean; isTeam?: boolean; grants: Grant[] };
export type Target = { eventId?: string; seriesId?: string };

/** Combine explicit grants, including series authority inherited by its events. */
export function allows(access: Access, target: Target, role: Role = "editor") {
    return (
        access.isAdmin ||
        (role === "editor" && !!access.isTeam) ||
        access.grants.some(
            (grant) =>
                (role === "editor" || grant.role === "organiser") &&
                (grant.scope.kind === "event"
                    ? grant.scope.id === target.eventId
                    : grant.scope.id === target.seriesId),
        )
    );
}

/** Creation requires an organiser's series grant; a standalone event requires an admin. */
export function canCreate(access: Access, seriesId?: string) {
    return allows(access, { seriesId }, "organiser");
}
