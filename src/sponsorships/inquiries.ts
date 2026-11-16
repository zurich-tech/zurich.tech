import { site } from "../app/site";

/** Open an editable sponsorship inquiry in the visitor's email app. */
export function sponsorshipInquiry(tier?: string, name?: string, company?: string) {
    const body = `Hi zurich.tech team,\n\nI am ${name || "[your name]"} from ${company || "[organisation]"}. We're interested in sponsoring zurich.tech${tier ? ` in the ${tier} tier` : ""}.\n\nCould you let us know the next steps?\n\nBest,\n${name || "[your name]"}`;
    return `mailto:${site.sponsorshipEmail}?subject=${encodeURIComponent("Sponsorship inquiry")}&body=${encodeURIComponent(body)}`;
}
