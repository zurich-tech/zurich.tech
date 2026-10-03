import { siteOrigin } from "../auth/environment";

/** Label and destination of an email action. */
type Link = { label: string; url: string };

/** Public destinations shared by community email footers. */
export const socials = [
    { label: "Discord", url: "https://discord.gg/373R4C3872" },
    { label: "LinkedIn", url: "https://www.linkedin.com/company/zurichai/" },
    { label: "X", url: "https://x.com/zurichnlp" },
];

/** Email colours, matching the site's light theme. */
export const palette = {
    brand: "#174ed8",
    paper: "#f7f6f2",
    ink: "#14223a",
    soft: "#5d6878",
    line: "#d8d5cb",
    wash: "#eeece5",
};

/** Mono stack for headings and labels; clients without web fonts fall back to system monospace. */
export const mono = "'JetBrains Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace";

/** Text stack for body copy. */
export const text = "Arial,Helvetica,sans-serif";

/** Render a complete email with one masthead, content column and footer. */
export function layout(options: {
    title: string;
    preview?: string;
    eyebrow?: string;
    afterAction?: string;
    isCommunity?: boolean;
    body: string;
    action?: Link;
    links?: Link[];
}) {
    const origin = siteOrigin();
    const links = [
        { label: "zurich.tech", url: origin },
        ...(options.links ?? []),
        { label: "Legal", url: `${origin}/legal` },
    ];

    // the masthead is the site's map band with its bleeding wordmark
    const masthead = `<a href="${escapeHtml(origin)}" style="display:block;line-height:0"><img src="${escapeHtml(`${origin}/branding/mail.png`)}" alt="zurich.tech" width="600" height="120" style="display:block;width:100%;max-width:600px;height:auto;border:0;background:${palette.brand}" /></a>`;

    // one square primary action
    const action = options.action
        ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px"><tr><td bgcolor="${palette.brand}" style="mso-padding-alt:14px 22px"><a href="${escapeHtml(options.action.url)}" style="display:inline-block;padding:14px 22px;border:1px solid ${palette.brand};color:#ffffff;font:bold 15px/1.4 ${text};text-decoration:none">${escapeHtml(options.action.label)} &rarr;</a></td></tr></table>`
        : "";

    // separate community destinations from subscription controls
    const social = options.isCommunity
        ? `<p style="margin:0 0 12px">${socials.map((link) => `<a href="${link.url}" style="color:${palette.brand};text-decoration:underline;margin-right:20px">${link.label}</a>`).join(" ")}</p>`
        : "";
    const eyebrow = options.eyebrow
        ? `<p style="margin:0 0 12px;color:${palette.soft};font:12px/1.5 ${mono}">${escapeHtml(options.eyebrow)}</p>`
        : "";

    // quiet footer links
    const footer = links
        .map(
            (link) =>
                `<a href="${escapeHtml(link.url)}" style="display:inline-block;margin-right:16px;color:${palette.soft};text-decoration:underline">${escapeHtml(link.label)}</a>`,
        )
        .join(" ");

    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(options.title)}</title><style>body{margin:0!important;padding:0!important}a:hover{text-decoration:underline!important}a:focus{outline:2px solid ${palette.brand};outline-offset:3px}@media(max-width:600px){.mail-frame{padding:0!important}.mail-content{padding:28px 20px!important}.mail-footer{padding:24px 20px!important}}</style></head><body bgcolor="${palette.paper}" style="background:${palette.paper};color:${palette.ink};font-family:${text};font-size:16px;line-height:1.6"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(options.preview ?? options.title)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${palette.paper}"><tr><td class="mail-frame" align="center" style="padding:24px 12px"><!--[if mso]><table role="presentation" width="600"><tr><td><![endif]--><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;table-layout:fixed"><tr><td>${masthead}</td></tr><tr><td class="mail-content" bgcolor="#ffffff" style="padding:32px;overflow-wrap:anywhere;word-wrap:break-word">${eyebrow}<h1 style="margin:0 0 24px;font:600 28px/1.25 ${mono};letter-spacing:0">${escapeHtml(options.title)}</h1>${options.body}${action}${options.afterAction ?? ""}</td></tr><tr><td class="mail-footer" style="padding:24px 32px;font:12px/1.8 ${text};color:${palette.soft}">${social}<p style="margin:0 0 8px">zurich.tech · A volunteer-run non-profit for people in tech around Zurich.</p>${footer}</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}

/** Render a section label with one quiet separator. */
export function sectionHeading(title: string) {
    return `<h2 style="margin:28px 0 0;padding-top:16px;border-top:1px solid ${palette.line};color:${palette.soft};font:500 13px/1.4 ${mono};letter-spacing:0">${escapeHtml(title)}</h2>`;
}

/** Render a short paragraph with safe line breaks. */
export function paragraph(value: string) {
    return `<p style="margin:16px 0;line-height:1.6">${escapeHtml(value).replaceAll("\n", "<br>")}</p>`;
}

/** Escape text and attribute values before including them in email HTML. */
export function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
