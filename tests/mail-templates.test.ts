import { afterAll, beforeAll, expect, test } from "bun:test";
import { excerpt } from "../convex/mail/markdown";
import { programmeContent } from "../convex/mail/programme";
import {
    involvement,
    profileInvitation,
    profilePlaceholder,
    sharing,
} from "../convex/mail/involvement";
import {
    eventEmail,
    newsletterEmail,
    newsletterEdition,
    newsSentence,
    campaignEmail,
    seriesEmail,
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

test("test_render_consistent_profile_actions_and_public_sharing", () => {
    expect(profileInvitation("none")).toEqual({ html: "", text: "" });
    expect(profileInvitation("create").text).toBe(
        "Sign Up: https://zurich.tech/settings?section=profile\nFaster RSVPs. Your topics and alerts.",
    );
    expect(profileInvitation("complete").text).toBe(
        "Complete Your Profile: https://zurich.tech/settings?section=profile\nChoose your topics and alerts.",
    );
    const participation = involvement("none");
    expect(participation.html).not.toContain("WhatsApp");
    expect(participation.text).toContain("Pass something good to a friend.");
    expect(participation.text).toContain("Meet people and exchange ideas.");
    expect(participation.text).toContain("Speak, host or help out.");
    expect(() => sharing("Share", "Example", "/registration?token=secret")).toThrow(
        "Email sharing requires a public site URL without parameters or fragments.",
    );
    expect(() => sharing("Share", "Example", "https://example.com/")).toThrow(
        "Email sharing requires a public site URL without parameters or fragments.",
    );
});

test("test_limit_event_participation_to_appropriate_messages_and_public_links", () => {
    for (const title of ["New event", "Registration confirmed", "Event reminder", "Thank you"]) {
        const email = eventEmail(event, title, {
            manageUrl: "https://zurich.tech/registration?token=secret",
        });
        expect(email.text).toContain(profilePlaceholder.text);
        expect(email.html).toContain(profilePlaceholder.html);
        const urls: string[] = [];
        new HTMLRewriter()
            .on("a", {
                element(element) {
                    const href = element.getAttribute("href")!;
                    if (
                        href.startsWith("mailto:") ||
                        href.includes("/sharing/") ||
                        href.includes("/intent/")
                    )
                        urls.push(href);
                },
            })
            .transform(email.html);
        const encoded = encodeURIComponent("https://zurich.tech/events/zurichnlp-22");
        expect(urls).toEqual([
            `mailto:?body=${encoded}`,
            `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
            `https://twitter.com/intent/tweet?url=${encoded}`,
        ]);
        expect(eventEmail({ ...event, visibility: "unlisted" }, title).text).not.toContain(
            "intent/tweet",
        );
        expect(eventEmail({ ...event, status: "draft" }, title).text).not.toContain("intent/tweet");
    }
    for (const title of [
        "Event updated",
        "Event cancelled",
        "Event confirmed",
        "Registration pending",
        "Registration waitlisted",
        "Registration declined",
        "Registration cancelled",
        "Registration received",
    ]) {
        const email = eventEmail(event, title);
        expect(email.text).not.toContain(profilePlaceholder.text);
        expect(email.html).not.toContain("Get involved");
    }
});

test("test_include_bounded_jobs_sponsors_and_full_followup_participation", () => {
    const sponsors: Parameters<typeof newsletterEdition>[1] = [
        {
            name: "Sponsor & Co",
            tier: "gold",
            website: "https://example.com",
            logoUrl: "/sponsors/eth-ai-center.svg",
        },
    ];
    const jobs: NonNullable<Parameters<typeof newsletterEdition>[2]> = Array.from(
        { length: 9 },
        (_, index) => ({
            slug: `role-${index}`,
            title: `Role ${index}`,
            company: { slug: `company-${index % 3}`, name: "Company" },
            locations: [{ locality: "Zurich", countryCode: "CH" }],
            workplace: "hybrid",
            engagement: "employment",
            workload: { min: 80, max: 100 },
            compensation: undefined,
            summary: "Build tools.",
        }),
    );
    const followup = eventEmail(event, "Thank you", {
        sponsors,
        jobs,
        manageUrl: "https://zurich.tech/registration?token=secret",
    });
    for (const content of [followup.html, followup.text]) {
        expect(content).toContain("Join Discord");
        expect(content).toContain("Volunteer");
        expect(content).toContain("Sponsors");
        expect(content).toContain("Role 2");
        expect(content).toContain("Role 5");
        expect(content).not.toContain("Role 6");
        expect(content).toContain("All jobs");
    }
    expect(followup.html).toContain(profilePlaceholder.html);
    expect(followup.html).toContain("/sponsors/eth-ai-center.png");
    expect(followup.html.indexOf("token=secret")).toBeLessThan(
        followup.html.indexOf("Get involved"),
    );

    // apply the same company cap and final section order to newsletters and event emails
    const newsletter = newsletterEdition([], sponsors, jobs);
    const series = seriesEmail(
        { name: "ZurichNLP", slug: "zurichnlp", description: "NLP talks." },
        {
            frequency: "monthly",
            interval: 1,
            weekdays: [],
            start: "2026-10-12",
            time: "18:00",
            timezone: "Europe/Zurich",
            excluded: [],
        },
        "https://zurich.tech/unsubscribe?token=example",
        { sponsors, jobs },
    );
    for (const email of [
        followup,
        newsletter,
        series,
        campaignEmail({ subject: "News", message: "Community news." }, undefined, {
            sponsors,
            jobs,
        }),
        eventEmail(event, "New event", { sponsors, jobs }),
        eventEmail(event, "Registration confirmed", { sponsors, jobs }),
        eventEmail(event, "Event reminder", { sponsors, jobs }),
    ]) {
        for (const content of [email.html, email.text]) {
            const included = jobs
                .filter((job) => content.includes(job.title))
                .map((job) => job.slug);
            expect(included).toEqual(["role-0", "role-1", "role-2", "role-3", "role-4", "role-5"]);
            expect(content.indexOf("Get involved")).toBeLessThan(content.indexOf("Sponsor &"));
            expect(content.indexOf("Sponsor &")).toBeLessThan(content.indexOf("Role 0"));
            expect(content.indexOf("Role 5")).toBeLessThan(content.indexOf("All jobs"));
        }
    }

    // include substantive notifications but keep urgent changes free of promotions
    const confirmation = eventEmail(event, "Registration confirmed", { sponsors, jobs });
    expect(confirmation.text).toContain("Sponsors");
    expect(confirmation.text).toContain("Role 0");
    const reminder = eventEmail(event, "Event reminder", { sponsors, jobs });
    expect(reminder.text).toContain("Sponsors");
    expect(reminder.text).toContain("Role 0");
    expect(eventEmail(event, "Event updated", { sponsors, jobs }).text).not.toContain("Sponsors");
    expect(eventEmail(event, "Event cancelled", { sponsors, jobs }).text).not.toContain("Role 0");
    expect(eventEmail(event, "Thank you").html).not.toContain("Sponsors");
    expect(eventEmail(event, "Thank you").text).not.toContain("All jobs");
});

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
        company: {
            slug: "research",
            name: "Research & Co",
            logoUrl: "/sponsors/eth-ai-center.svg",
        },
        locations: [],
        workplace: "hybrid" as const,
        engagement: "employment" as const,
        workload: { min: 80, max: 100 },
        compensation: undefined,
        summary: "Build research tools.",
    };
    const illustrated = newsletterEdition([], [], [job]);
    const textOnly = newsletterEdition(
        [],
        [],
        [{ ...job, company: { slug: job.company.slug, name: job.company.name } }],
    );
    expect(illustrated.html).toContain('src="https://zurich.tech/sponsors/eth-ai-center.png"');
    expect(illustrated.html).toContain('alt="Research &amp; Co"');
    expect(textOnly.html).not.toContain("<img");
    expect(illustrated.text).toBe(textOnly.text);
    expect(illustrated.html).toContain('width="52" valign="top"');
    expect(textOnly.html).toContain('width="52" valign="top"');
    expect(illustrated.html).toContain("padding:16px 0 16px 16px");
});

test("test_stack_participation_actions_above_descriptions", () => {
    const html = involvement("complete").html;
    expect(html.match(/display:block;margin-top:3px/g)).toHaveLength(4);
    expect(html).not.toContain("<table");
    expect(html).toContain("Complete Your Profile &rarr;");
});

test("test_format_series_dates_for_readers", () => {
    const email = seriesEmail(
        { name: "Builders", slug: "builders", description: "Monthly talks." },
        {
            frequency: "monthly",
            interval: 1,
            weekdays: [],
            start: "2026-10-12",
            end: "2027-02-12",
            time: "18:00",
            timezone: "Europe/Zurich",
            excluded: [],
        },
        "https://zurich.tech/unsubscribe",
    );
    expect(email.html).toContain("From 12 October 2026 until 12 February 2027");
    expect(email.text).toContain("From 12 October 2026 until 12 February 2027");
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
            `Confirm registration: ${url}`,
            "Expires in one hour. If you didn’t request this, ignore this email.",
            involvement("none", { html: "", text: "" }).text,
            "zurich.tech: https://zurich.tech",
            "Legal: https://zurich.tech/legal",
        ].join("\n\n"),
    );
});

test("test_frame_verification_details_and_place_security_note_before_participation", () => {
    const url = "https://zurich.tech/confirm?token=private-token";
    for (const entry of [event, undefined]) {
        const email = verificationEmail(url, entry);
        expect(
            email.html.match(/href="https:\/\/zurich.tech\/confirm\?token=private-token"/g),
        ).toHaveLength(1);
        expect(email.html.indexOf(url)).toBeLessThan(email.html.indexOf("Expires in one hour"));
        expect(email.html.indexOf("Expires in one hour")).toBeLessThan(
            email.html.indexOf("Get involved"),
        );
        expect(email.html).not.toContain(profilePlaceholder.html);
        expect(email.text).not.toContain(profilePlaceholder.text);
        expect(email.html).not.toContain("Share the Event");
        expect(email.html).not.toContain("Sign Up");
    }

    const registration = verificationEmail(url, event);
    expect(registration.html).toContain("margin:24px 0 0;padding:20px;border-left:3px");
    const restricted = verificationEmail(url, {
        ...event,
        address: "Private venue address",
        addressAccess: { kind: "confirmed" },
    });
    expect(restricted.html).not.toContain("Private venue address");
    expect(restricted.text).not.toContain("Private venue address");
});

test("test_preserve_non_event_email_subjects", () => {
    expect(verificationEmail("https://zurich.tech/verify?token=test").subject).toBe(
        "Confirm your subscription",
    );
    expect(signInEmail("123456").subject).toBe("Your zurich.tech sign-in code");
});

test("test_share_typography_and_one_masthead_across_email_families", () => {
    const emails = [
        signInEmail("123456"),
        verificationEmail("https://zurich.tech/confirm?token=test"),
        verificationEmail("https://zurich.tech/confirm?token=test", event),
        newsletterEmail(newsletterEdition([event], [])),
        campaignEmail({ subject: "Community update", message: "Hello everyone." }),
        ...[
            "New event",
            ...Object.values(registrationCopy).map((copy) => copy.title),
            "Registration received",
            "Event reminder",
            "Event updated",
            "Event confirmed",
            "Event cancelled",
            "Thank you",
        ].map((title) => eventEmail(event, title)),
    ];

    for (const email of emails) {
        expect(email.html.match(/class="mail-title"/g)).toHaveLength(1);
        expect(email.html.match(/\/branding\/mail.png/g)).toHaveLength(1);
        expect(email.html.match(/class="mail-footer"/g)).toHaveLength(1);
        expect(email.html).toContain("font:16px/1.6 Arial,Helvetica,sans-serif");
        expect(email.html).toContain(".mail-title{font-size:24px!important}");
    }
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
        news: [
            {
                slug: "news",
                date: Date.UTC(2026, 9, 12),
                title: "Research & community",
                description: "A published story.",
            },
        ],
    });
    const email = newsletterEmail(edition, "https://zurich.tech/unsubscribe?token=example");
    expect(email.html).toContain("Research &amp; community");
    expect(email.text).toContain("Research & community");
    expect(email.html).toContain("https://zurich.tech/news/2026/10/12/news");
    expect(email.text).toContain("https://zurich.tech/news/2026/10/12/news");
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

test("test_limit_newsletter_stories_to_the_opening_sentence", () => {
    const description = "Researchers raised USD 5.4 million. A second sentence.\n\nMore detail.";
    expect(newsSentence(description)).toBe("Researchers raised USD 5.4 million.");
    expect(newsSentence("A single summary without punctuation")).toBe(
        "A single summary without punctuation",
    );
    expect(newsSentence("  ")).toBe("");
    const edition = newsletterEdition([], [], [], {
        news: [{ title: "Research", slug: "research", date: Date.UTC(2026, 9, 14), description }],
    });
    expect(edition.html).toContain("Researchers raised USD 5.4 million.");
    expect(edition.text).toContain("Researchers raised USD 5.4 million.");
    expect(edition.html).not.toContain("A second sentence");
    expect(edition.text).not.toContain("More detail");
});

test("test_align_digest_dates_without_event_panels", () => {
    const edition = newsletterEdition(
        [{ ...event, location: "ETH AI Center", summary: "Two talks." }],
        [],
        [],
    );
    expect(edition.html).toContain('width="52" valign="top"');
    expect(edition.html).toContain("18:00 · ETH AI Center");
    expect(edition.html).toContain("Two talks.");
    expect(edition.html).not.toContain("background:#f4f7ff");
    expect(edition.html).not.toContain("View event");
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
