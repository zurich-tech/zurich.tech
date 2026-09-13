import { Marked } from "marked";
import { createMemo } from "solid-js";

const parser = new Marked({
    async: false,
    gfm: true,
    renderer: {
        /** Render embedded HTML as visible text. */
        html({ text }) {
            return escapeHtml(text);
        },

        /** Render image syntax as its alternative text. */
        image({ text }) {
            return escapeHtml(text);
        },

        /** Render links with an allowed URL protocol. */
        link({ href, title, tokens }) {
            const text = this.parser.parseInline(tokens);
            if (!isSafeLink(href)) {
                return text;
            }

            const titleAttribute =
                title === null || title === undefined ? "" : ` title="${escapeHtml(title)}"`;

            return `<a href="${escapeHtml(href)}"${titleAttribute}>${text}</a>`;
        },
    },
});

/** Render trusted Markdown without allowing embedded HTML or images. */
export function Markdown(props: { source: string }) {
    const html = createMemo(() => renderMarkdown(props.source));

    return <div class="markdown" innerHTML={html()} />;
}

/** Render Markdown into constrained article HTML. */
export function renderMarkdown(source: string) {
    return parser.parse(source, { async: false });
}

/** Return whether one article link uses an allowed protocol. */
function isSafeLink(href: string) {
    try {
        const url = new URL(href, "https://zurich.tech");
        return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
    } catch {
        return false;
    }
}

/** Escape text for HTML content and attributes. */
function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
