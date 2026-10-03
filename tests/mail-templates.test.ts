import { afterAll, beforeAll, expect, test } from "bun:test";
import { excerpt } from "../convex/mail/markdown";
import { programmeContent } from "../convex/mail/programme";
import {
    eventEmail,
    newsletterEmail,
    newsletterEdition,
    campaignEmail,
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

test("test_highlight_speakers_and_group_invitation_logistics", () => {
    const programme = {
        speakers: [
            {
                name: "Speaker <One>",
                imageUrl: "/portrait.jpg",
                affiliations: [{ role: "Researcher", organisation: "A & B" }],
            },
        ],
        sessions: [{ time: "18:30", title: "Models & evaluation" }],
    };
    const rendered = programmeContent(programme);
    expect(rendered.text).toBe(
        "Speakers\nSpeaker <One> · Researcher · A & B\n\nProgramme\n18:30 · Models & evaluation",
    );
    expect(rendered.html).toContain("Speaker &lt;One&gt;");
    expect(rendered.html).toContain("Models &amp; evaluation");
    expect(rendered.html).toContain('src="https://zurich.tech/portrait.jpg"');
    expect(programmeContent({ speakers: [], sessions: [] })).toEqual({ html: "", text: "" });
    expect(programmeContent({ speakers: [{ name: "Guest" }], sessions: [] }).html).not.toContain(
        "<img",
    );

    const email = eventEmail(
        { ...event, location: "ETH AI Center", address: "Andreasstrasse 5" },
        "New event",
        { programme },
    );
    expect(email.html.indexOf("Speakers")).toBeLessThan(email.html.indexOf("When &amp; where"));
    expect(email.html).toMatch(/<strong>ETH AI Center<\/strong><br>.*Andreasstrasse 5/);
    expect(email.text).toContain(rendered.text);
});

test("test_include_company_logos_without_changing_plain_text_jobs", () => {
    const job = {
        title: "Research Engineer",
        slug: "research-engineer",
        company: { name: "Research & Co", logoUrl: "/sponsors/eth-ai-center.svg" },
        locations: [],
        workplace: "hybrid" as const,
        engagement: "employment" as const,
        workload: { min: 80, max: 100 },
        compensation: undefined,
        summary: "Build research tools.",
    };
    const illustrated = newsletterEdition([], [], [job]);
    const textOnly = newsletterEdition([], [], [{ ...job, company: { name: job.company.name } }]);
    expect(illustrated.html).toContain('src="https://zurich.tech/sponsors/eth-ai-center.png"');
    expect(illustrated.html).toContain('alt="Research &amp; Co"');
    expect(textOnly.html).not.toContain("<img");
    expect(illustrated.text).toBe(textOnly.text);
});

test("test_start_newsletter_with_content_without_an_intro", () => {
    const edition = newsletterEdition([event], []);
    expect(edition.text.split("\n\n")[0]).toBe(
        "ZurichNLP #22\nMonday, 12 October 2026 · 18:00 · Zurich time\nhttps://zurich.tech/events/zurichnlp-22",
    );
    expect(edition.html.startsWith("<h2")).toBe(true);
    expect(edition.preview).toBe(event.title);
});

test("test_extract_campaign_preview_without_markdown", () => {
    expect(excerpt("# Update\n\nMeet **the team** and [join us](https://example.com).")).toBe(
        "Meet the team and join us.",
    );
    expect(excerpt("# Heading only")).toBe("A note from the zurich.tech team.");
    expect(excerpt("x".repeat(200))).toBe("x".repeat(160));
});

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
            "Confirm your email address to finish submitting your registration. We’ll then email you your registration status.",
            "ZurichNLP #22\nMonday, 12 October 2026 · 18:00 · Zurich time\nhttps://zurich.tech/events/zurichnlp-22",
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
            "Discord: https://discord.gg/373R4C3872",
            "LinkedIn: https://www.linkedin.com/company/zurichai/",
            "X: https://x.com/zurichnlp",
            "Email preferences: https://zurich.tech/settings?section=notifications",
            "Legal: https://zurich.tech/legal",
        ].join("\n\n"),
    );
    expect(email.html).toContain("This week in zurich.tech");
    expect(email.html).not.toContain("This week at zurich.tech");
});

test("test_keep_event_states_clear_and_sensitive_addresses_out_of_public_editions", () => {
    const privateEvent = {
        ...event,
        address: "Private room",
        addressAccess: { kind: "confirmed" as const },
    };
    for (const [status, copy] of Object.entries(registrationCopy)) {
        const email = eventEmail(privateEvent, copy.title, { description: copy.description });
        expect(email.text).toContain(copy.description);
        expect(email.html).not.toContain("Private room");
        expect(email.html).toContain("Address shared after registration confirmation");
        if (status === "going") expect(email.html).toContain("You’re on the list");
    }
    const edition = newsletterEdition([privateEvent], [], [], { date: event.startsAt });
    expect(edition.html).not.toContain("Private room");
    expect(edition.text).not.toContain("Private room");
    expect(edition.html).not.toContain("Address shared after");
});

test("test_render_news_involvement_and_one_primary_action_without_duplicate_rules", () => {
    const edition = newsletterEdition([event], [], [], {
        date: event.startsAt,
        news: [{ slug: "news", title: "Research & community", description: "A published story." }],
    });
    const email = newsletterEmail(edition, "https://zurich.tech/unsubscribe?token=example");
    expect(email.html).toContain("Research &amp; community");
    expect(email.text).toContain("Research & community");
    expect(email.html).toContain("Get involved");
    expect(email.html).toContain("12 October 2026");
    expect(email.html).not.toContain("border-bottom:2px");
    expect(email.html).not.toContain("border-top:2px");
    expect(email.html).toContain("Unsubscribe");
    expect(signInEmail("123456").html).not.toContain("discord.gg");
    expect(
        campaignEmail({
            subject: "Hello",
            message: "[Register](https://zurich.tech/events/example)",
        }).html,
    ).not.toContain("Visit zurich.tech");
});

test("test_escape_event_copy_and_keep_pass_usable_without_images", () => {
    const email = eventEmail(
        { ...event, title: '<img src=x onerror="bad()">' },
        "Registration confirmed",
        {
            manageUrl: "https://zurich.tech/registration?token=example&view=pass",
            passUrl: "https://zurich.tech/pass.png?token=example",
        },
    );
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img");
    expect(email.html).toContain("View pass");
    expect(email.html).toContain("token=example&amp;view=pass");
    expect(email.text).toContain(
        "View pass: https://zurich.tech/registration?token=example&view=pass",
    );
});
