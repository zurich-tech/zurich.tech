import { expect, test } from "bun:test";
import { renderMarkdown } from "../src/components/markdown";

test("article links reject executable and malformed URLs without breaking rendering", () => {
    expect(renderMarkdown("[unsafe](javascript:alert%281%29)")).not.toContain("href=");
    expect(renderMarkdown("[broken](http://[invalid)")).not.toContain("href=");
    expect(renderMarkdown("[event](/events/example)")).toContain('href="/events/example"');
    expect(renderMarkdown("<script>alert(1)</script>")).not.toContain("<script>");
});
