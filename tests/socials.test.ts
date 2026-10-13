import { expect, test } from "bun:test";
import { socialRedirect } from "../src/server/socials";

test("test_redirect_social_paths_without_caching_or_forwarding_parameters", async () => {
    const destinations = {
        discord: "https://discord.gg/373R4C3872",
        linkedin: "https://www.linkedin.com/company/zurichai/",
        github: "https://github.com/zurich-tech",
        x: "https://x.com/zurichnlp",
        twitter: "https://x.com/zurichnlp",
    };
    for (const [path, destination] of Object.entries(destinations)) {
        for (const method of ["GET", "HEAD"]) {
            for (const suffix of ["", "/", "?next=https://example.com"]) {
                const response = socialRedirect({
                    request: new Request(`https://zurich.tech/${path}${suffix}`, { method }),
                });
                expect(response.status).toBe(302);
                expect(Object.fromEntries(response.headers)).toEqual({
                    "cache-control": "no-store",
                    location: destination,
                });
                expect(await response.text()).toBe("");
            }
        }
    }
});

test("test_reject_unknown_social_destinations", () => {
    expect(socialRedirect({ request: new Request("https://zurich.tech/unknown") }).status).toBe(
        404,
    );
});
