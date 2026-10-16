import { siteOrigin } from "../auth/environment";
import { escapeHtml, palette, sectionHeading, socials } from "./layout";

/** Only account and profile copy affect the prompt, never private survey answers. */
export type ProfilePrompt = "create" | "complete" | "none";

/** Code-owned placeholders resolved once for each email recipient. */
export const profilePlaceholder = {
    text: "[[zurich.tech:profile:text]]",
    html: "<!--zurich.tech:profile:html-->",
};

/** Render one compact invitation in HTML and plain text. */
function invitation(
    label: string,
    description: string,
    url: string,
    links: { label: string; url: string }[] = [],
) {
    const actions = links
        .map(
            (link, index) =>
                `<a href="${escapeHtml(link.url)}" style="display:inline-block;color:${palette.brand};text-decoration:underline${index < links.length - 1 ? ";margin-right:10px" : ""}">${escapeHtml(link.label)}</a>`,
        )
        .join(" ");

    return {
        html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;font-size:14px;line-height:1.5"><tr><td width="116" valign="baseline" style="vertical-align:baseline;padding:10px 12px 0 0"><a href="${escapeHtml(url)}" style="color:${palette.brand};font-weight:600;text-decoration:underline">${escapeHtml(label)}</a></td><td valign="baseline" style="vertical-align:baseline;padding:10px 0 0;color:${palette.soft}">${escapeHtml(description)}${actions ? `<div style="margin-top:4px">${actions}</div>` : ""}</td></tr></table>`,
        text: [
            `${label}: ${url}`,
            description,
            ...links.map((link) => `${link.label}: ${link.url}`),
        ].join("\n"),
    };
}

/** Offer profile setup without requiring publication or optional demographics. */
export function profileInvitation(prompt: ProfilePrompt) {
    if (prompt === "none") return { html: "", text: "" };

    return invitation(
        prompt === "create" ? "Sign Up" : "Complete Your Profile",
        "Share your interests to help us create better events.",
        `${siteOrigin()}/settings?section=profile`,
    );
}

/** Render sharing actions for a public website path, never a recipient token. */
export function sharing(title: string, description: string, path = "/") {
    const url = new URL(path, siteOrigin());
    if (url.origin !== new URL(siteOrigin()).origin || url.search || url.hash) {
        throw new Error(
            "Email sharing requires a public site URL without parameters or fragments.",
        );
    }
    const destination = url.href;
    const links = [
        { label: "Email", url: `mailto:?body=${encodeURIComponent(destination)}` },
        {
            label: "LinkedIn",
            url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(destination)}`,
        },
        {
            label: "X",
            url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(destination)}`,
        },
    ];

    return invitation(title, description, destination, links);
}

/** Invite participation without competing with the edition's main content. */
export function involvement(
    prompt?: ProfilePrompt,
    share = sharing("Share zurich.tech", "Introduce someone to zurich.tech."),
) {
    const profile = prompt ? profileInvitation(prompt) : profilePlaceholder;
    const invitations = [
        invitation("Join Discord", "Ask questions and discuss events.", socials[0].url),
        invitation(
            "Volunteer",
            "Give a talk, host an event, volunteer or suggest an idea.",
            `${siteOrigin()}/contribute`,
        ),
        share,
    ];

    return {
        html: `${sectionHeading("Get involved", `${siteOrigin()}/contribute`)}${profile.html}${invitations.map((entry) => entry.html).join("")}`,
        text: ["Get involved", profile.text, ...invitations.map((entry) => entry.text)]
            .filter(Boolean)
            .join("\n\n"),
    };
}
