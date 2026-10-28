import { siteOrigin } from "../auth/environment";
import { escapeHtml, palette, sectionHeading, socials } from "./layout";

/** Invitation states expose completion and update status, never private answers. */
export type ProfilePrompt = "create" | "complete" | "update" | "none";

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
        html: `<div style="padding:14px 0;border-bottom:1px solid ${palette.line};font-size:14px;line-height:1.5"><a href="${escapeHtml(url)}" style="display:block;color:${palette.brand};text-decoration:none"><span style="font-weight:600">${escapeHtml(label)} &rarr;</span><span style="display:block;margin-top:3px;color:${palette.soft}">${escapeHtml(description)}</span></a>${actions ? `<div style="margin-top:8px">${actions}</div>` : ""}</div>`,
        text: [
            `${label}: ${url}`,
            description,
            ...links.map((link) => `${link.label}: ${link.url}`),
        ].join("\n"),
    };
}

/** Render separate account and survey actions for the recipient's current state. */
export function profileInvitation(prompt: ProfilePrompt) {
    if (prompt === "none") return { html: "", text: "" };

    // give every unfinished survey its own action
    const survey = invitation(
        prompt === "update" ? "Update your survey" : "Complete the survey",
        prompt === "update"
            ? "New questions. Tell us what you think."
            : "Help shape future events.",
        `${siteOrigin()}/survey`,
    );
    if (prompt !== "create") return survey;

    // invite account creation separately from survey participation
    const account = invitation(
        "Sign up",
        "Faster RSVPs. Your topics and alerts.",
        `${siteOrigin()}/settings?section=profile`,
    );

    return {
        html: account.html + survey.html,
        text: `${account.text}\n\n${survey.text}`,
    };
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
    share = sharing("Share zurich.tech", "Pass something good to a friend."),
) {
    const profile = prompt ? profileInvitation(prompt) : profilePlaceholder;
    const invitations = [
        invitation("Join Discord", "Meet people and exchange ideas.", socials[0].url),
        invitation("Help out", "Speak, host or lend a hand.", `${siteOrigin()}/contribute`),
        share,
    ];

    return {
        html: `${sectionHeading("Get involved", `${siteOrigin()}/contribute`)}${profile.html}${invitations.map((entry) => entry.html).join("")}`,
        text: ["Get involved", profile.text, ...invitations.map((entry) => entry.text)]
            .filter(Boolean)
            .join("\n\n"),
    };
}
