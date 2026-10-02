import { afterAll, beforeAll, expect, test } from "bun:test";
import {
    eventEmail,
    newsletterEmail,
    registrationCopy,
    signInEmail,
    verificationEmail,
} from "../convex/mail/templates";

/** Event used across notification templates. */
const event = {
    title: "ZurichNLP #22",
    slug: "zurichnlp-22",
    startsAt: Date.parse("2026-10-12T16:00:00Z"),
};

/** Preserve the caller's website configuration. */
const previousSiteUrl = process.env.SITE_URL;

beforeAll(() => {
    process.env.SITE_URL = "https://zurich.tech";
});

afterAll(() => {
    if (previousSiteUrl === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previousSiteUrl;
});

test("test_prefix_event_notifications_with_event_title", () => {
    const titles = [
        "New event",
        "Event updated",
        "Event confirmed",
        "Event cancelled",
        "Thank you",
        ...Object.values(registrationCopy).map((copy) => copy.title),
    ];

    for (const title of titles) {
        expect(eventEmail(event, title).subject).toBe(`ZurichNLP #22: ${title}`);
    }
});

test("test_prefix_custom_reminder_subject_with_event_title", () => {
    expect(eventEmail(event, "Event reminder", { subject: "Reminder" }).subject).toBe(
        "ZurichNLP #22: Reminder",
    );
});

test("test_name_registration_verification_by_event_and_action", () => {
    const url = "https://zurich.tech/verify?token=test";
    const email = verificationEmail(url, event);

    expect(email.subject).toBe("ZurichNLP #22: Confirm your registration");
    expect(email.text).toBe(
        [
            "Confirm registration",
            "ZurichNLP #22\n12 October 2026 · 18:00 · Zurich time\nhttps://zurich.tech/events/zurichnlp-22",
            "Expires in one hour. If you didn’t request this, ignore this email.",
            `Confirm registration: ${url}`,
            "zurich.tech: https://zurich.tech",
            "Legal: https://zurich.tech/legal",
        ].join("\n\n"),
    );
});

test("test_preserve_non_event_email_subjects", () => {
    expect(verificationEmail("https://zurich.tech/verify?token=test").subject).toBe(
        "Confirm your subscription",
    );
    expect(signInEmail("123456").subject).toBe("Your zurich.tech sign-in code");
});

test("test_name_weekly_newsletter_consistently", () => {
    const email = newsletterEmail({ text: "Weekly news", html: "<p>Weekly news</p>" });

    expect(email.subject).toBe("This week in zurich.tech");
    expect(email.text).toBe(
        [
            "This week in zurich.tech",
            "Weekly news",
            "Notifications: https://zurich.tech/settings",
            "Legal: https://zurich.tech/legal",
        ].join("\n\n"),
    );
    expect(email.html).toContain("This week in zurich.tech");
    expect(email.html).not.toContain("This week at zurich.tech");
});
