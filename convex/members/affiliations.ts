import { v, type Infer } from "convex/values";

/** Ordered professional affiliations, independent of community roles and access. */
export const affiliations = v.array(v.object({ role: v.string(), organisation: v.string() }));
export type Affiliation = Infer<typeof affiliations>[number];

/** Validate and trim authored affiliations without interpreting free-text headlines. */
export function normaliseAffiliations(values: Affiliation[]) {
    if (values.length > 6) throw new Error("Use at most six affiliations.");

    return values.map(({ role, organisation }) => {
        const affiliation = { role: role.trim(), organisation: organisation.trim() };
        if (!affiliation.role && !affiliation.organisation)
            throw new Error("Enter a role or organisation.");
        if (affiliation.role.length > 120 || affiliation.organisation.length > 160)
            throw new Error("Keep roles within 120 characters and organisations within 160.");

        return affiliation;
    });
}

/** Keep compact copy consistent without using it as stored identity. */
export function affiliationText(values: Affiliation[] | undefined) {
    return values
        ?.map(({ role, organisation }) => [role, organisation].filter(Boolean).join(" · "))
        .join("; ");
}
