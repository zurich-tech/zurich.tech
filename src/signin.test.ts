import { describe, expect, test } from "bun:test";

import { parseSignInCallback } from "./signin";

describe("parseSignInCallback", () => {
    test("test_extract_one_time_token", () => {
        const url = new URL("https://zurich.tech/settings?ott=session-token&tab=profile#email");
        const callback = parseSignInCallback(url);

        expect(callback).toEqual({
            token: "session-token",
            url: new URL("https://zurich.tech/settings?tab=profile#email"),
        });
        expect(url.toString()).toBe(
            "https://zurich.tech/settings?ott=session-token&tab=profile#email",
        );
    });

    test("test_ignore_regular_location", () => {
        const url = new URL("https://zurich.tech/settings");

        expect(parseSignInCallback(url)).toBeNull();
    });
});
