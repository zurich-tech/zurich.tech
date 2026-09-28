import { Marked } from "marked";
import { escapeHtml, palette } from "./layout";

/** Render campaign formatting without embedded HTML or remote images. */
const parser = new Marked({
    async: false,
    gfm: true,
    breaks: true,
    renderer: {
        /** Display raw HTML rather than executing it in an email. */
        html({ text }) {
            return escapeHtml(text);
        },
        /** Preserve image descriptions without loading external content. */
        image({ text }) {
            return escapeHtml(text);
        },
        /** Restrict destinations to explicit web and email URLs. */
        link({ href, tokens }) {
            const label = this.parser.parseInline(tokens);
            if (!/^(https?:\/\/|mailto:)/i.test(href)) return label;

            return `<a href="${escapeHtml(href)}" style="color:${palette.brand};text-decoration:underline">${label}</a>`;
        },
        /** Apply the shared email paragraph spacing. */
        paragraph({ tokens }) {
            return `<p style="margin:16px 0;line-height:1.6">${this.parser.parseInline(tokens)}</p>`;
        },
    },
});

/** Format campaign text with safe automatic links and paragraph styles. */
export function markdown(source: string) {
    return parser.parse(source, { async: false });
}
