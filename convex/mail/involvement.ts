import { siteOrigin } from "../auth/environment";
import { escapeHtml, palette, sectionHeading, socials } from "./layout";

/** Only account and profile copy affect the prompt, never private survey answers. */
export type ProfilePrompt = "create" | "complete" | "none";

/** Code-owned placeholders resolved once for each newsletter recipient. */
export const profilePlaceholder = {
    text: "[[zurich.tech:profile:text]]",
    html: "<!--zurich.tech:profile:html-->",
};

/** Render one compact invitation in HTML and plain text. */
function invitation(label: string, description: string, url: string) {
    return {
        html: `<p style="margin:14px 0"><a href="${escapeHtml(url)}" style="color:${palette.brand};font-weight:600;text-decoration:underline">${escapeHtml(label)}</a><br><span style="color:${palette.soft};font-size:14px">${escapeHtml(description)}</span></p>`,
        text: `${label}: ${url}\n${description}`,
    };
}

/** Offer profile setup without requiring publication or optional demographics. */
export function profileInvitation(prompt: ProfilePrompt) {
    if (prompt === "none") return { html: "", text: "" };

    return invitation(
        prompt === "create" ? "Create your profile" : "Complete your profile",
        "You choose what to share and whether your profile is public.",
        `${siteOrigin()}/settings?section=profile`,
    );
}

/** Invite participation without competing with the edition's main content. */
export function involvement(prompt?: ProfilePrompt) {
    const profile = prompt ? profileInvitation(prompt) : profilePlaceholder;
    const invitations = [
        invitation("Join Discord", "Ask questions and discuss events.", socials[0].url),
        invitation(
            "Volunteer",
            "Give a talk, host an event, volunteer or suggest an idea.",
            `${siteOrigin()}/contribute`,
        ),
    ];

    return {
        html: `${sectionHeading("Get involved")}${profile.html}${invitations.map((entry) => entry.html).join("")}`,
        text: ["Get involved", profile.text, ...invitations.map((entry) => entry.text)]
            .filter(Boolean)
            .join("\n\n"),
    };
}
