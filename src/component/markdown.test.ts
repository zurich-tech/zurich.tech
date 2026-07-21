import { describe, expect, test } from "bun:test";

import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
    test("test_render_article_elements", () => {
        const markdown = "## Heading\n\nText with **weight** and [link](/news).";
        const html = renderMarkdown(markdown);

        expect(html).toBe(
            '<h2>Heading</h2>\n<p>Text with <strong>weight</strong> and <a href="/news">link</a>.</p>\n',
        );
    });

    test("test_escape_embedded_html", () => {
        const html = renderMarkdown('<script type="module">alert(1)</script>');

        expect(html).toBe("&lt;script type=&quot;module&quot;&gt;alert(1)&lt;/script&gt;");
    });

    test("test_remove_executable_links_and_images", () => {
        const markdown = "[run](javascript:alert(1)) ![remote](https://example.com/image.png)";
        const html = renderMarkdown(markdown);

        expect(html).toBe("<p>run remote</p>\n");
    });
});
