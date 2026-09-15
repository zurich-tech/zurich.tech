# News

Put the funding announcement in the headline.
Use exactly one short sentence for the description: company name, present-tense verb, what it builds.
Write “Exclaim develops robots to maintain AI data centers.”
Avoid substitutes such as “the Zurich startup” or “the ETH spin-off”, progressive constructions such as “is developing”, and investor lists in the description.
Omit promotional quotes, unsupported superlatives and predictions.
Use direct headline verbs: “raises”, “acquires”, “opens” and “releases”.
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

A brief has frontmatter and may include one or two factual context sentences in its body:

```yaml
---
kind: link
category: funding
title: "Company raises USD 25M Series A"
subtitle: "Company develops robots to maintain AI data centers."
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
Set `category: "funding"` for financing announcements and use `topics` for the actual technology; Funding is not a member interest.
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

For non-funding news, prefer usable software, model or hardware releases; significant real deployments; substantial technical infrastructure; and acquisitions with a concrete local consequence.
Skip routine partnerships, awards, hiring posts, event promotion and generic research publicity.
State what changed in the headline and give one concrete sentence of context.
Distinguish plans, pilots, released artifacts and operational systems explicitly.
