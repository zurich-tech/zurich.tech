import { siteOrigin } from "../auth/environment";

/** Label and destination of an email action. */
type Link = { label: string; url: string };

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
        ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px"><tr><td bgcolor="${palette.brand}" style="mso-padding-alt:14px 22px"><a href="${escapeHtml(options.action.url)}" style="display:inline-block;padding:14px 22px;border:1px solid ${palette.brand};color:#ffffff;font:bold 15px/1 ${text};text-decoration:none">${escapeHtml(options.action.label)} &rarr;</a></td></tr></table>`
        : "";

    // quiet mono footer links
    const footer = links
        .map(
            (link) =>
                `<a href="${escapeHtml(link.url)}" style="color:${palette.soft};text-decoration:underline">${escapeHtml(link.label)}</a>`,
        )
        .join(`<span style="color:${palette.line}">&nbsp;&nbsp;/&nbsp;&nbsp;</span>`);

    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(options.title)}</title><style>body{margin:0!important;padding:0!important}a:hover{text-decoration:underline!important}a:focus{outline:2px solid ${palette.brand};outline-offset:3px}@media(max-width:600px){.mail-frame{padding:0!important}.mail-content{padding:28px 20px!important}}</style></head><body bgcolor="${palette.paper}" style="background:${palette.paper};color:${palette.ink};font-family:${text};font-size:16px;line-height:1.6"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(options.preview ?? options.title)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${palette.paper}"><tr><td class="mail-frame" align="center" style="padding:24px 12px"><!--[if mso]><table role="presentation" width="600"><tr><td><![endif]--><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px"><tr><td>${masthead}</td></tr><tr><td class="mail-content" style="padding:36px 0 32px"><h1 style="margin:0 0 24px;padding-bottom:16px;border-bottom:2px solid ${palette.ink};font:500 28px/1.15 ${mono};letter-spacing:-1px">${escapeHtml(options.title)}</h1>${options.body}${action}</td></tr><tr><td style="border-top:1px solid ${palette.line};padding:20px 0 8px;font:12px/1.8 ${mono};color:${palette.soft}">${footer}</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}

/** Render a section heading as a mono label on a strong rule, as on the site. */
export function sectionHeading(title: string) {
    return `<h2 style="margin:36px 0 0;padding-top:12px;border-top:2px solid ${palette.ink};color:${palette.ink};font:500 12px/1.4 ${mono};letter-spacing:1px;text-transform:uppercase">${escapeHtml(title)}</h2>`;
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
