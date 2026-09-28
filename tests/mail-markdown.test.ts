import { expect, test } from "bun:test";
import { markdown } from "../convex/mail/markdown";

test("test_render_clickable_campaign_links", () => {
    expect(markdown("Register: https://zurich.tech/events/zurichnlp-22\nhello@zurich.tech")).toBe(
        '<p style="margin:16px 0;line-height:1.6">Register: <a href="https://zurich.tech/events/zurichnlp-22" style="color:#174ed8;text-decoration:underline">https://zurich.tech/events/zurichnlp-22</a><br><a href="mailto:hello@zurich.tech" style="color:#174ed8;text-decoration:underline">hello@zurich.tech</a></p>',
    );
});

test("test_reject_active_content_and_unsafe_links", () => {
    expect(
        markdown(
            "[bad](javascript:alert) ![photo](https://example.com/pixel) <img src=x onerror=alert(1)>",
        ),
    ).toBe(
        '<p style="margin:16px 0;line-height:1.6">bad photo &lt;img src=x onerror=alert(1)&gt;</p>',
    );
});
