import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import qrcode from "qrcode-generator";
import {
    campaignEmail,
    eventEmail,
    newsletterEdition,
    newsletterEmail,
    registrationCopy,
    seriesEmail,
    signInEmail,
    verificationEmail,
    type NewsletterStory,
} from "../../convex/mail/templates";
import { escapeHtml, paragraph } from "../../convex/mail/layout";
import {
    attendedResources,
    invitationCopy,
    resourcesPlaceholder,
    welcome,
} from "../../convex/mail/attendance";
import {
    profileInvitation,
    profilePlaceholder,
    type ProfilePrompt,
} from "../../convex/mail/involvement";

// render fictional examples locally, with no database or delivery calls
process.env.SITE_URL = "https://zurich.tech";
const directory = resolve(process.argv[2] ?? "/tmp/zurich-tech-email-previews");
const event = {
    title: "ZurichNLP #22",
    slug: "zurichnlp-22",
    startsAt: Date.parse("2026-10-12T16:00:00Z"),
    location: "ETH AI Center",
    address: "Andreasstrasse 5, 8050 Zurich",
    summary: "Two NLP talks, followed by questions and discussion.",
};
const unsubscribe = "https://zurich.tech/unsubscribe?token=preview-only";
// use public portraits in this fictional programme, not as an announced speaker lineup
const programme = {
    speakers: [
        {
            name: "Clara Meister",
            imageUrl: "/team/clara-meister.jpeg",
            affiliations: [{ role: "Sample speaker", organisation: "Research" }],
        },
        {
            name: "Alessio Rimoldi",
            imageUrl: "/team/alessio-rimoldi.jpeg",
            affiliations: [{ role: "Sample speaker", organisation: "Industry" }],
        },
    ],
    sessions: [
        { time: "18:00", title: "Doors open" },
        { time: "18:30", title: "Evaluating language models beyond benchmarks" },
        { time: "19:00", title: "Building multilingual NLP systems" },
        { time: "19:30", title: "Questions and discussion" },
    ],
};
const registration = "https://zurich.tech/registration?token=preview-only";
const sponsors: Parameters<typeof newsletterEdition>[1] = [
    {
        name: "ETH AI Center",
        tier: "gold",
        website: "https://ai.ethz.ch",
        logoUrl: "/sponsors/eth-ai-center.svg",
    },
];
const jobs: NonNullable<Parameters<typeof newsletterEdition>[2]> = [
    {
        title: "Research Engineer",
        slug: "example-role",
        company: {
            slug: "eth-ai-center",
            name: "ETH AI Center",
            logoUrl: "/sponsors/eth-ai-center.svg",
        },
        summary: "Build and evaluate NLP tools.",
        locations: [{ locality: "Zurich", countryCode: "CH" }],
        workplace: "hybrid",
        engagement: "employment",
        workload: { min: 80, max: 100 },
        compensation: undefined,
    },
];
const pass = qrcode(0, "M");
pass.addData(registration);
pass.make();
// exercise the current public edition's density without querying production or sending email
const newsletterEvents = [
    {
        title: "The Builders Run #6",
        slug: "builders-run-6",
        startsAt: Date.parse("2026-10-23T05:00:00Z"),
        location: "Zürich",
        summary:
            "An 8 km morning run with Daniel Stadelmann and Edo Treccani, followed by optional coffee.",
    },
    {
        title: "Autoresearch Log #1",
        slug: "autoresearch-log-1",
        startsAt: Date.parse("2026-10-23T16:00:00Z"),
        location: "J floor",
        summary:
            "Maksym Andriushchenko (ELLIS Institute Tübingen) on automating LLM post-training, followed by paper discussions and demos.",
    },
    {
        title: "ZurichCV #15",
        slug: "zurichcv-15",
        startsAt: Date.parse("2026-10-29T17:00:00Z"),
        location: "ETH AI Center",
        summary:
            "Said Gürbüz (ETH Zurich) on controllable desktop environments for computer use agents, and Lorenzo Steno (Seldon Technologies) on building RL environments for computer use.",
    },
];
const edition = newsletterEdition(newsletterEvents, sponsors, jobs, {
    date: Date.parse("2026-10-16T06:00:00Z"),
    news: process.argv[3]
        ? ((await Bun.file(process.argv[3]).json()) as NewsletterStory[])
              .filter((story) => story.date <= Date.now())
              .sort((left, right) => right.date - left.date || left.slug.localeCompare(right.slug))
              .slice(0, 5)
        : [
              {
                  title: "ETH builds architectural elements with bacteria",
                  slug: "eth-biocement",
                  date: Date.parse("2026-10-14T08:00:00Z"),
                  description:
                      "ETH Zurich researchers developed a printable mixture of sand, bacteria and natural gels to make architectural elements, including a facade component. After printing, daily mineralisation baths let the bacteria form calcium carbonate crystals that bind the sand together. The material hardens at room temperature over two to five days, without firing it in a kiln.",
                  image: "https://ethz.ch/bin/ethz/components/previewImage/youtube/L-v83ikx2-k.jpg",
              },
          ],
});
const previews = [
    ...(["create", "complete", "none"] as ProfilePrompt[]).map((profile) => {
        const email = newsletterEmail(edition, unsubscribe);
        const invitation = profileInvitation(profile);
        return {
            name: `Newsletter · ${profile}`,
            ...email,
            html: email.html
                .replaceAll(profilePlaceholder.html, invitation.html)
                .replaceAll(resourcesPlaceholder.html, ""),
            text: email.text
                .replaceAll(profilePlaceholder.text, invitation.text)
                .replaceAll(resourcesPlaceholder.text, ""),
        };
    }),
    {
        name: "New event",
        ...eventEmail(event, "New event", {
            sponsors,
            jobs,
            summary: true,
            unsubscribeUrl: unsubscribe,
            programme,
        }),
    },
    ...Object.values(registrationCopy).map((copy) => ({
        name: copy.title,
        ...eventEmail(event, copy.title, {
            sponsors,
            jobs,
            description: copy.description,
            manageUrl: ["Registration cancelled", "Registration declined"].includes(copy.title)
                ? undefined
                : registration,
        }),
    })),
    {
        name: "Tentative registration",
        ...eventEmail(
            {
                ...event,
                confirmation: {
                    isApprovalRequired: true,
                    timing: "deadline",
                    decidesAt: event.startsAt - 86400000,
                },
            },
            "Registration received",
            { manageUrl: registration },
        ),
    },
    {
        name: "Reminder",
        ...eventEmail(event, "Event reminder", {
            sponsors,
            jobs,
            subject: "Reminder",
            manageUrl: registration,
            programme,
        }),
    },
    {
        name: "Event confirmed",
        ...eventEmail(event, "Event confirmed", { manageUrl: registration }),
    },
    {
        name: "Event cancelled",
        ...eventEmail({ ...event, status: "cancelled" }, "Event cancelled", {
            manageUrl: registration,
        }),
    },
    {
        name: "Event updated",
        ...eventEmail(event, "Event updated", {
            description: "Venue: Previous venue → ETH AI Center\nThe date and time are unchanged.",
            manageUrl: registration,
        }),
    },
    {
        name: "Follow-up",
        ...eventEmail(event, "Thank you", {
            sponsors,
            jobs,
            description:
                "Thanks for coming to ZurichNLP #22. Your feedback helps us plan the next one.",
            actionLabel: "Share your feedback",
            manageUrl: registration + "#feedback",
            unsubscribeUrl: unsubscribe,
        }),
    },
    { name: "Sign in", ...signInEmail("123456") },
    {
        name: "Verify registration",
        ...verificationEmail("https://zurich.tech/verify?token=preview-only", event),
    },
    {
        name: "Verify subscription",
        ...verificationEmail("https://zurich.tech/verify?token=preview-only"),
    },
    {
        name: "New series",
        ...seriesEmail(
            {
                name: "Zurich Builders",
                slug: "example-series",
                description:
                    "A regular evening for people building things. Share what you’re working on, exchange ideas and meet potential collaborators.",
            },
            {
                frequency: "monthly",
                interval: 1,
                weekdays: [],
                start: "2026-10-12",
                time: "18:00",
                timezone: "Europe/Zurich",
                excluded: [],
            },
            unsubscribe,
            { sponsors, jobs },
        ),
    },
    {
        name: "Written campaign",
        ...campaignEmail(
            {
                subject: "Let’s build Zurich tech together",
                message:
                    "Hello,\n\nWe’re bringing people from across Zurich’s technology community together. Whether you’d like to give a talk, host an evening or lend a hand, there’s room to get involved.\n\n[Find your way to contribute](https://zurich.tech/contribute)\n\nSee you soon,\nThe zurich.tech team",
            },
            unsubscribe,
            { sponsors, jobs },
        ),
    },
    {
        name: "Confirmation with check-in pass",
        ...eventEmail(event, "Registration confirmed", {
            sponsors,
            jobs,
            manageUrl: registration,
            passUrl: pass.createDataURL(6, 24),
        }),
    },
];

// show attendance examples separately from the default recipient variants
const resources = attendedResources([
    { title: "ZurichNLP #21", slug: "zurichnlp-21", hasPhotos: true, hasLinks: true },
]);
const returning = invitationCopy("ZurichNLP #21");
const invitation = eventEmail(event, "New event", {
    sponsors,
    jobs,
    summary: true,
    unsubscribeUrl: unsubscribe,
    programme,
});
const newsletter = newsletterEmail(edition, unsubscribe);
previews.push(
    {
        name: "Invitation after a confirmed check-in",
        ...invitation,
        html: invitation.html.replace(paragraph(welcome), returning.html),
        text: invitation.text.replace(welcome, returning.text),
    },
    {
        name: "Newsletter with attended-event resources",
        ...newsletter,
        html: newsletter.html
            .replaceAll(profilePlaceholder.html, "")
            .replaceAll(resourcesPlaceholder.html, resources.html),
        text: newsletter.text
            .replaceAll(profilePlaceholder.text, "")
            .replaceAll(resourcesPlaceholder.text, resources.text),
    },
);

// resolve the same placeholders as delivery, exposing each recipient state for review
const variants = previews.flatMap((preview) => {
    if (!preview.html.includes(profilePlaceholder.html)) return [preview];

    return (["create", "complete", "none"] as ProfilePrompt[]).map((state) => {
        const profile = profileInvitation(state);

        return {
            ...preview,
            name: `${preview.name} · ${state}`,
            html: preview.html.replaceAll(profilePlaceholder.html, profile.html),
            text: preview.text.replaceAll(profilePlaceholder.text, profile.text),
        };
    });
});
previews.splice(0, previews.length, ...variants);

// write template output and plain text, alongside desktop and narrow browser previews
await mkdir(directory, { recursive: true });
for (const [index, preview] of previews.entries()) {
    await Bun.write(`${directory}/${index}.html`, preview.html);
    await Bun.write(`${directory}/${index}.txt`, preview.text);
    await Bun.write(
        `${directory}/${index}-review.html`,
        `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escapeHtml(preview.name)}</title><style>body{font:15px Arial;background:#edf0f4;color:#14223a;margin:24px}main{display:flex;gap:24px;flex-wrap:wrap}iframe{height:1800px;border:1px solid #ccd1db;background:white}a{color:#174ed8}h2{font-size:14px}</style><a href="index.html">All previews</a><h1>${escapeHtml(preview.name)}</h1><p>Subject: ${escapeHtml(preview.subject)}</p><p><a href="${index}.html">Full email</a> · <a href="${index}.txt">Plain text</a></p><main><section><h2>Desktop · 600px email in a 720px viewport</h2><iframe title="Desktop email" width="720" src="${index}.html"></iframe></section><section><h2>Mobile · 320px</h2><iframe title="Mobile email" width="320" src="${index}.html"></iframe></section></main></html>`,
    );
}
await Bun.write(
    `${directory}/index.html`,
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Email previews</title><style>body{font:16px/1.6 Arial;max-width:720px;margin:40px auto;color:#14223a}a{color:#174ed8}li{margin:8px 0}</style><h1>Email previews</h1><p>Fictional sample content, rendered with the actual email templates. Nothing is sent. Profile variants: create = no account, complete = unfinished profile, none = no prompt.</p><ul>${previews.map((preview, index) => `<li><a href="${index}-review.html">${escapeHtml(preview.name)}</a></li>`).join("")}</ul></html>`,
);
console.log(`Email previews: ${directory}/index.html`);
