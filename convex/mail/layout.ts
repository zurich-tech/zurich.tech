import { siteOrigin } from "../auth/environment";

/** Label and destination of an email action. */
type Link = { label: string; url: string };

/** Render a complete email with one shared header, content column and footer. */
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
    // use the raster logo with fixed dimensions for email clients that do not render SVG
    const logo = (size: number) =>
        `<img src="${escapeHtml(`${origin}/branding/logo.png`)}" alt="" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border:0" />`;
    const brand = `<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="padding-right:12px"><a href="${escapeHtml(origin)}">${logo(32)}</a></td><td><a href="${escapeHtml(origin)}" style="color:#174ed8;font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-1px;text-decoration:none">zurich.tech</a></td></tr></table>`;
    const action = options.action
        ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:24px"><tr><td bgcolor="#174ed8" style="border-radius:3px;mso-padding-alt:12px 20px"><a href="${escapeHtml(options.action.url)}" style="display:inline-block;padding:12px 20px;border:1px solid #174ed8;border-radius:3px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">${escapeHtml(options.action.label)}</a></td></tr></table>`
        : "";
    const footer = links
        .map(
            (link) =>
                `<a href="${escapeHtml(link.url)}" style="color:#526074;text-decoration:underline">${escapeHtml(link.label)}</a>`,
        )
        .join(' <span style="color:#cbd0d3">&nbsp;·&nbsp;</span> ');

    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(options.title)}</title><style>body{margin:0!important;padding:0!important}a:hover{text-decoration:underline!important}a:focus{outline:2px solid #174ed8;outline-offset:3px}@media(max-width:600px){.mail-frame{padding:16px 8px!important}.mail-content{padding:24px 20px!important}}</style></head><body bgcolor="#f1f3f5" style="background:#f1f3f5;color:#182a44;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(options.preview ?? options.title)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="mail-frame" align="center" style="padding:32px 12px"><!--[if mso]><table role="presentation" width="600"><tr><td><![endif]--><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px"><tr><td bgcolor="#ffffff" class="mail-content" style="padding:28px 32px;border:1px solid #d5d9df;background:#ffffff">${brand}<hr style="border:0;border-top:1px solid #d5d9df;margin:24px 0"><h1 style="font-size:24px;line-height:1.3;margin:0 0 20px;font-weight:700">${escapeHtml(options.title)}</h1>${options.body}${action}</td></tr><tr><td align="left" style="padding:16px 8px;font-size:12px;line-height:1.8;color:#526074"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td valign="top" style="padding:2px 12px 0 0"><a href="${escapeHtml(origin)}">${logo(24)}</a></td><td style="font-size:12px;line-height:1.8;color:#526074">${footer}</td></tr></table></td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}

/** Render a short paragraph with safe line breaks. */
export function paragraph(text: string) {
    return `<p style="margin:16px 0;line-height:1.6">${escapeHtml(text).replaceAll("\n", "<br>")}</p>`;
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
