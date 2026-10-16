# News

## Format

Use a short headline, one to three substantive paragraphs, original media and a direct source link.
Explain what happened, how the technology works and what the result or next step actually is.
A generic company description is not a news brief.
Summarise the original reporting in our own words, retaining qualifications and distinguishing company claims from demonstrated results.
Do not pad a thin announcement to meet a length target; omit it if there is not enough substance.
Put the paragraphs in a multiline `subtitle`; leave the body empty unless it adds essential context.
Do not repeat the summary below the media or reproduce extended passages from the source.
For demos, use the original playable HTTPS video URL in `video` and its still poster in `image`.
The feed, detail page and editor preview use the same media component, with controls and inline playback.
Direct video files and YouTube or Vimeo links are supported; hosted players load only after clicking Play.
Keep `image` for social previews and email clients, which cannot reliably play video.
Put media credits and a short description of what is shown in `caption`, not in the article body.
Use photographs for stories without a useful demo; do not substitute a screenshot for a playable video.
Withdrawn sources live in `withdrawn/`, outside the import catalogue, with the decision recorded in `research/`.

Put the concrete achievement in the headline.
For funding, explain what the company builds and the concrete work the round supports.
Write “Exclaim develops robots to maintain AI data centers.”
Avoid substitutes such as “the Zurich startup” or “the ETH spin-off”, progressive constructions such as “is developing”, and investor lists in the description.
Omit promotional quotes, unsupported superlatives and predictions.
Use direct headline verbs: “raises”, “acquires”, “demonstrates” and “releases”.
Use “to acquire” or “to sell” for signed deals pending completion at the announcement date; avoid “agrees to” and “announces an agreement to”.

## Funding briefs

Use `Company raises USD 25M Series A` as the headline pattern: company, amount, stage.
Omit investor names from headlines and descriptions.
Preserve qualifications such as “up to”; an announced financing ceiling is not a completed raise of that amount.
Preserve the announced currency with an explicit ISO code (`CHF`, `USD`, `EUR`); do not convert amounts.
Use the announcement date, not the date we added the story.
Link directly to the company: its announcement page when available, otherwise its homepage.
Use reporting to verify the funding facts, not as the default reader destination.
Choose only relevant existing topic slugs.
Leave authors empty for external briefs; they are curated links, not articles credited to our team.

A brief has frontmatter and usually an empty body:

```yaml
---
kind: link
category: funding
title: "Company raises USD 25M Series A"
subtitle: |-
    Company has raised USD 25M to bring its maintenance robots into production. The robots inspect server racks and identify equipment that needs attention without taking the whole room offline.

    The funding will support manufacturing and deployment of the first production units. Describe the demonstrated capabilities and remaining limitations here, using the actual announcement rather than promotional claims.
date: "2026-08-17"
url: "https://example.com/announcement"
authors: []
topics: ["robotics"]
---
```

## Authored posts

Use `kind: post` and a Markdown body, without an external `url`.
Authors are public member handles; organisations are canonical organisation slugs.
An authored post needs at least one author or organisation credit.

## Importing

Convex is the only source of published news, including this backfill.
These files and research notes are import sources and provenance; the application build does not read them.
After import, edit and publish news through the website editor.

Preview with `bun scripts/news/import.ts dev <recording-member-id>`.
Add `--apply` to import after all batches validate.
Use `prod` only for an explicitly approved production import after deploying the backend.
The recording member must have an active administrator account.
Imports preserve announcement dates and match stable slugs.
Identical records are skipped; any conflicting draft or published content stops the import rather than overwriting website edits.
Imports do not send email or social posts.

## Selection

Cover technology companies headquartered in Zurich or operating a substantive local engineering, research or production team.
Headquarters elsewhere do not disqualify a company.
A registered address, sales office or founder’s university affiliation alone does not establish a substantive local operation.
Record the local connection and its source in `research/companies.md`.
Keep older qualifying announcements in their original year when backfilling company coverage.
Use the original announcement date; a repost, updated page or report publication is not a new round.
Include announced financing of at least 1M in CHF, EUR or USD, preserving the original currency.
Exclude grants, awards, undisclosed amounts that cannot meet the threshold, and secondary share sales from fundraising.
Do not confuse cumulative funding with the size of a new round.
Use the news editor's single Tags selector for both Funding and the relevant technology topics.
Funding is a news label, not a member interest.
Existing import sources retain their funding category field for compatibility; new editor saves store all labels together.
Keep one or two specific technology topics rather than tagging every financing as Startups.
Record verification sources and unresolved cases in `research/<year>.json`.
Keep private investment separate from grants, and identify debt or convertible financing explicitly.
Describe an extended round total as “extends Series A to”, not as a fresh raise of the entire amount.
Drug-development biotech is included alongside medical devices and software.

## Discovery

Use Startupticker, Tech.eu, EU-Startups, company newsrooms and investor announcements together.
Use Greater Zurich Area, ETH AI Center, ETH Zurich and relevant company/founder LinkedIn and X posts to discover leads, then follow the original announcement.
Use EPFL selectively for work with a Zurich connection or exceptional technical relevance.
Social feeds and search indexes are incomplete; never describe this archive as a complete registry of private financing.

For non-funding news, prefer demonstrated hardware, usable software or model releases, substantial technical infrastructure and research results with a concrete artifact or experiment.
An acquisition is not newsworthy here merely because a local company changes ownership.
Require both a substantive Zurich connection and a technology angle.
Zurich-based companies, local research groups and developments with a specific local consequence qualify.
Incidental Zurich team involvement in a global product update does not qualify on its own.
Skip routine partnerships, awards, hiring posts, event promotion and generic research publicity.
Skip office openings, routine certifications, customer wins and funding for studies that have not produced results.
The bar is significant fundraising or a significant product, technical or company milestone, not simply a recent company announcement.
A demonstrated rocket-engine firing qualifies; a new office or an unspecified investment does not.
State what changed in the headline and explain the mechanism, evidence and limits in the brief.
Distinguish plans, pilots, released artifacts and operational systems explicitly.

## Images

Every story needs a relevant cover image before publication.
Prefer a real project, product, experiment or demo image from the original announcement.
For funding stories, a verified photograph of the team is appropriate when no useful product image exists.
Set its HTTPS URL in the `image` field and record its source, subject and credit with the research notes.
Do not use an unrelated stock photograph, generated illustration or company logo as a cover.
Do not present a current team photograph as the team at an older funding announcement.
Existing image-free stories need a researched backfill, not placeholder artwork.
