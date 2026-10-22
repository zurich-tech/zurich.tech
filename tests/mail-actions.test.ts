import { afterAll, beforeAll, expect, test } from "bun:test";
import { eventEmail, newsletterEdition } from "../convex/mail/templates";
import type { Registration } from "../convex/events/fields";

/** Restore the environment after rendering with the public website origin. */
const previousSiteUrl = process.env.SITE_URL;
beforeAll(() => {
    process.env.SITE_URL = "https://zurich.tech";
});
afterAll(() => {
    if (previousSiteUrl === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previousSiteUrl;
});

/** Event with native booking used by invitation checks. */
const event = {
    title: "ZurichCV #15",
    slug: "zurichcv-15",
    startsAt: Date.parse("2026-10-29T17:00:00Z"),
    registration: {
        kind: "native",
        admission: "automatic",
        capacity: null,
        overflow: "waitlist",
        questions: [],
    } satisfies Registration,
};

/** Read the primary button and its adjacent alternative from rendered email HTML. */
function actions(html: string) {
    const links: { url: string; label: string }[] = [];
    new HTMLRewriter()
        .on('table[style="margin-top:28px"] a', {
            element(element) {
                links.push({ url: element.getAttribute("href")!, label: "" });
            },
            text(chunk) {
                links[links.length - 1]!.label += chunk.text;
            },
        })
        .transform(html);

    return links.map((link) => ({ ...link, label: link.label.replaceAll("&rarr;", "→") }));
}

test("prioritize registration in new and follow-up invitations", () => {
    for (const options of [
        {},
        { subject: "Coming up", description: "You signed up previously." },
    ]) {
        expect(actions(eventEmail(event, "New event", options).html)).toEqual([
            { label: "Register →", url: "https://zurich.tech/events/zurichcv-15#register" },
            { label: "View event", url: "https://zurich.tech/events/zurichcv-15" },
        ]);
    }
});

test("respect external booking and events without registration", () => {
    expect(
        actions(
            eventEmail(
                { ...event, registration: { kind: "external", url: "https://luma.com/example" } },
                "New event",
            ).html,
        ),
    ).toEqual([
        { label: "Register →", url: "https://luma.com/example" },
        { label: "View event", url: "https://zurich.tech/events/zurichcv-15" },
    ]);
    for (const entry of [
        { ...event, registration: { kind: "none" } as const },
        { ...event, status: "cancelled" },
    ]) {
        expect(actions(eventEmail(entry, "New event").html)).toEqual([
            { label: "View event →", url: "https://zurich.tech/events/zurichcv-15" },
        ]);
    }
});

test("retain recipient-specific actions for attendees", () => {
    for (const [title, options, label] of [
        ["Registration confirmed", {}, "Manage registration →"],
        ["Event reminder", { passUrl: "https://example.com/pass" }, "View pass →"],
        ["Thank you", { actionLabel: "Give feedback" }, "Give feedback →"],
    ] as const) {
        expect(
            actions(
                eventEmail(event, title, {
                    ...options,
                    manageUrl: "https://example.com/registration",
                }).html,
            ),
        ).toEqual([{ label, url: "https://example.com/registration" }]);
    }
});

test("include registration destinations in both newsletter formats", () => {
    const edition = newsletterEdition([event], []);
    const destinations: string[] = [];
    new HTMLRewriter()
        .on('a[href$="#register"]', {
            element(element) {
                destinations.push(element.getAttribute("href")!);
            },
        })
        .transform(edition.html);

    expect(destinations).toEqual(["https://zurich.tech/events/zurichcv-15#register"]);
    expect(edition.text.split("\n").filter((line) => line.startsWith("Register:"))).toEqual([
        "Register: https://zurich.tech/events/zurichcv-15#register",
    ]);
});
