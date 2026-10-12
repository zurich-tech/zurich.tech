# Zurich.tech product and engineering news candidates

Research cutoff: 2026-09-28, Europe/Zurich.
Eligible original announcement window: 2026-08-17 through 2026-09-28 inclusive.
This is a candidate report only, not publication-ready importer input.
No project files, production systems, subscriptions, accounts, email or social posts were changed.
No articles or images were copied into this report.

## Method and deduplication

The review opened actual company announcements, release notes, product documentation and GitHub pages rather than accepting search snippets as verification.
Dates below are original announcement or release dates explicitly displayed by those sources, with exceptions identified.
Company-issued releases distributed through EQS and EIN Presswire count as primary announcements, not independent validation of performance claims.
Undated product and company pages corroborate capabilities and location, not publication dates.
Categories are editorial descriptions, not proposed importer schema values.

Read the repository's `content/news/README.md`, `research/non-funding.md`, `research/coverage.md`, `research/sources.md` and `research/companies.md`.
Inventoried existing news filenames and searched the news tree and yearly provenance for the shortlisted companies and products.
Read the existing DeepJudge, Unique, KNIME, Metafuels, Loft Dynamics and Apertus briefs.
No exact announcement duplicate was found for the candidates below in the checked local material.
Existing financing coverage is not a duplicate of a later product release.
Production was not queried; the user's September 28 launch, September 1 xorlab and August 17 Gravis production context was accepted as supplied.

## Priority candidates

Editorial review supersedes the initial recommendations below: VS Code is rejected and LocalStack releases are held out of the preview.
Local team participation or a registered address alone does not make a global product update relevant local news.

These have concrete changes and verified dates inside the window.

### Scandit launches self-checkout loss prevention

- Original publication date: **2026-09-15**, explicitly stated in the company post and its dateline.
- Source title: Scandit Enters Loss Prevention Market: Self-Checkout Solution Reduces Loss While Keeping Shopping Frictionless.
- Source URL: [Company announcement](https://www.scandit.com/blog/scandit-enters-loss-prevention-market/).
- Primary corroboration: [Product page](https://www.scandit.com/solutions/self-checkout-loss-prevention/) and [technical explanation](https://www.scandit.com/blog/self-checkout-loss-prevention-vision-ai/).
- Summary: Scandit launches software that compares checkout camera observations with scanner and payment-system activity to flag missed items before a transaction finishes.
  It processes video at the checkout station and prompts shoppers or attendants without identifying shoppers through facial recognition.
- Zurich connection: [Scandit's company page](https://www.scandit.com/company/) identifies its global headquarters at Hardturmstrasse 181, Zurich.
- Category: Product launch; computer vision; retail technology.
- Editorial recommendation: **Strong include**; a specific new product with a clear technical architecture and everyday application.
- Confidence: **High** for announcement, date and local connection; performance and privacy assertions remain vendor claims.
- Caveat: Omit the claimed greater-than-75% loss recovery figure unless explicitly attributed; do not imply a named Swiss retailer deployment or independently certified legal compliance.
- Deduplication: No Scandit announcement found in the checked news tree.

### Sensirion launches SEN68 and SEN69C air-quality modules

- Original publication date: **2026-09-22**, company-issued EQS release dated 07:00 CET/CEST.
- Source title: Sensirion launches SEN68 and SEN69C for comprehensive indoor air quality monitoring.
- Source URL: [Sensirion release on EQS](https://www.eqs-news.com/news/corporate/sensirion-launches-sen68-and-sen69c-for-comprehensive-indoor-air-quality-monitoring/96530e2e-8a82-462f-892f-172f41cd1a17_en).
- Primary corroboration: [SEN68 product documentation](https://sensirion.com/products/catalog/SEN68) and [SEN69C product documentation](https://sensirion.com/products/catalog/SEN69C).
- Summary: Sensirion releases compact modules combining particle, humidity, temperature and gas measurements, with carbon-dioxide measurement added in SEN69C.
  The modules and a corresponding evaluation kit are available through distributors.
- Zurich connection: The announcement identifies Sensirion's headquarters in Staefa, canton Zurich, and gives its local address.
- Category: Hardware release; sensors; embedded systems.
- Editorial recommendation: **Strong include**; tangible available hardware, not a concept or financing story.
- Confidence: **High** for date, availability announcement and regional connection; no independent hardware testing performed.
- Caveat: Avoid unsupported superlatives; the two modules do not have identical measurement capabilities.
- Deduplication: No matching Sensirion item found.

### DeepJudge releases a ChatGPT Enterprise plugin

- Original publication date: **2026-09-17**, established by DeepJudge's dated EIN Presswire announcement.
- Date qualification: The company-hosted page says available today but exposes no calendar publication date in the retrieved text.
- Source title: DeepJudge Plugin Brings Institutional Intelligence to Legal AI in ChatGPT Enterprise.
- Source URL: [Company announcement](https://www.deepjudge.ai/news/deepjudge-openai-for-legal).
- Primary corroboration: [Dated company-issued release](https://www.einpresswire.com/article/943128975/deepjudge-plugin-brings-institutional-intelligence-to-legal-ai-in-chatgpt-enterprise).
- Summary: DeepJudge releases a plugin that lets ChatGPT Enterprise retrieve a legal team's internal precedents and work product through its existing knowledge platform.
  The company says retrieval preserves organisational permissions and links responses back to underlying material.
- Zurich connection: [DeepJudge's company page](https://www.deepjudge.ai/about-us) explicitly identifies Zurich headquarters.
- Category: Product release; legal technology; enterprise AI.
- Editorial recommendation: **Strong include**; clear availability language and a concrete integration rather than a partnership aspiration.
- Confidence: **High** for announcement and date; **medium-high** for practical availability because the plugin was not installed or tested.
- Caveat: Further workflow integrations are future work; do not imply they already ship or that the plugin is available to every consumer ChatGPT account.
- Deduplication: Existing DeepJudge seed and Series A briefs cover financing, not this release.

### KNIME Business Hub 1.19 adds controlled remote execution and preloaded jobs

- Original release date: **2026-09-03**, explicitly stated in the release notes.
- Source title: KNIME Business Hub 1.19 Release Notes.
- Source URL: [Official release notes](https://docs.knime.com/hub/latest/business_hub_release_notes/1.19/).
- Primary corroboration: [Sovereign execution architecture](https://docs.knime.com/hub/latest/remote_execution/architecture-details).
- Summary: KNIME Business Hub 1.19 adds controls over whether remotely executed workflow data passes through or remains in the Hub.
  It also introduces preloaded job pools to remove repeated loading from service requests and expands K-AI workflow and data-app capabilities.
- Zurich connection: [KNIME's company page](https://www.knime.com/about) identifies Zurich headquarters at Talacker 50.
- Category: Software release; data engineering; enterprise infrastructure.
- Editorial recommendation: **Include**, emphasising the specific execution and latency changes rather than the routine maintenance list.
- Confidence: **High** for release and headquarters; the individual feature authors' work locations are not attributed.
- Caveat: Business Hub is not the open-source Analytics Platform; do not call this an open-source release.
  The architecture documentation says sovereign execution is a paid add-on and that data movement depends on configuration, so avoid an unconditional claim that no data ever leaves the customer environment.
- Deduplication: Existing KNIME coverage is a 2024 funding brief.

### VS Code 1.139 extends agent sessions to remote Dev Containers

- Original release date: **2026-09-23**, explicitly shown by Microsoft's release notes and corroborated by the GitHub release day.
- Source title: Visual Studio Code 1.139.
- Source URL: [Official release notes](https://code.visualstudio.com/updates/v1_139).
- Primary corroboration: [GitHub release 1.139.0](https://github.com/microsoft/vscode/releases/tag/1.139.0).
- Summary: VS Code 1.139 adds agent sessions inside project Dev Containers on SSH, Tunnel and WSL hosts.
  It also improves large session lists and everyday editor behaviour.
- Zurich connection: The [release's engineering coordination issue](https://github.com/microsoft/vscode/issues/336502) explicitly assigns testing, fixes and release preparation across Redmond and Zurich and refers to the Zurich team releasing the stable build.
- Category: Developer tools; software release; open-source project.
- Editorial recommendation: **Include selectively** as a concrete release with direct Zurich engineering evidence, not as generic global Microsoft news.
- Confidence: **High** for release, date and substantive local participation.
- Caveat: The coordination issue establishes local involvement in this release, not that every highlighted feature was authored in Zurich.
  Do not imply all AI services or the Microsoft-distributed binary share the repository's licensing.
- Deduplication: No matching release found.

### Metafuels and PSI inaugurate the aerobrew demonstration plant

- Original publication and inauguration date: **2026-08-20**, explicitly displayed by PSI.
- Source title: Demonstration plant for sustainable aviation fuel inaugurated at PSI.
- Source URL: [PSI announcement](https://www.psi.ch/en/news/media-releases/demonstration-plant-for-sustainable-aviation-fuel-inaugurated).
- Primary corroboration: [German PSI release](https://www.psi.ch/de/news/medienmitteilungen/aerobrew-demonstrationsanlage-eingeweiht) is the same institutional announcement, not independent evidence.
- Summary: Metafuels and PSI open a demonstration installation for converting renewable methanol into synthetic aviation fuel.
  The facility moves their process into an industrially relevant plant design ahead of commercial scale-up.
- Zurich connection: PSI explicitly identifies Metafuels as Zurich-based; the physical plant is in Villigen, Aargau, not Zurich city.
- Category: Substantial engineering; climate technology; demonstration infrastructure.
- Editorial recommendation: **Strong include within the industrial-build remit**, with an overlap flag for any infrastructure researcher.
- Confidence: **High** for the event, date, facility status and company connection.
- Caveat: This is an inaugurated demonstration plant, not a commercial fuel-production launch or an academic-results story.
  Do not import the secondary discovery page's capacity or readiness-level figures without separately validating them.
- Deduplication: Existing Metafuels items cover 2025 and February 2026 financing, not this inauguration.

## Additional worthwhile candidates

These are usable alternatives or specialist briefs, with qualifications that should remain visible during selection.

### LocalStack introduces the lstk command-line tool

- Original publication date: **2026-09-08**, explicitly displayed in the company announcement.
- Source title: Meet lstk: A Better Way to Use LocalStack from the CLI.
- Source URL: [Company announcement](https://blog.localstack.cloud/introducing-lstk-cli/).
- Primary corroboration: [Company announcement index](https://blog.localstack.cloud/tags/announcement/) repeats the date; installation and migration documentation are linked from the announcement but were not independently opened in this pass.
- Summary: LocalStack introduces a consolidated command-line tool for starting emulators, authentication, configuration and snapshots without the previous Python dependency setup.
  Existing scripts using the older CLI continue to work at launch.
- Zurich connection: The existing company provenance records a US and Zurich operation; the [company team page](https://www.localstack.cloud/about) includes Zurich among employee locations and [company terms](https://www.localstack.cloud/legal/terms-of-service) identify Localstack GmbH at Uetlibergstrasse 95.
- Category: Developer-tool launch; cloud development.
- Editorial recommendation: **Include after a local-attribution check if applying the strictest team-specific standard**; strong utility, but this launch does not identify its authors' locations.
- Confidence: **High** for date and product change; **medium** for attribution of this particular release to Zurich engineers.
- Caveat: Do not label it an open-source launch without verifying the new CLI's licence.
- Deduplication: Existing LocalStack Series A brief is unrelated.

### LocalStack previews its next-generation Snowflake emulator

- Original publication date: **2026-09-02**, explicitly displayed by the company.
- Source title: Announcing the LocalStack for Snowflake 2026.08.0 Release.
- Source URL: [Official release announcement](https://blog.localstack.cloud/localstack-for-snowflake-2026-08-0/).
- Primary corroboration: [Company changelog](https://blog.localstack.cloud/changelog/) was discovered in search; the opened release announcement provides the actual verification.
- Summary: LocalStack opens an invitation-or-request preview of Snowflake-Next with change-data-capture streams, zero-copy cloning and historical-state testing.
  The separate standard 2026.08.0 release improves SQL and metadata compatibility.
- Zurich connection: Same qualified LocalStack operation evidence as the lstk candidate above.
- Category: Developer tools; database emulation; preview release.
- Editorial recommendation: **Consider for an engineering brief**, with the same local-attribution caveat; the preview is a genuine usable-access opportunity, not event promotion.
- Confidence: **High** for dated preview announcement; **medium** for local feature ownership.
- Caveat: Preview access is not general availability and is not included automatically in the standard upgrade.
  Omit the internal greater-than-10-times speed result or explicitly attribute it as a company regression-suite measurement.
- Deduplication: No matching news item found.

### LocalStack adds Lambda Durable Functions and CloudFront Functions emulation

- Original publication date: **2026-08-26**, explicitly displayed in the release announcement.
- Source title: Announcing the LocalStack for AWS 2026.08.0 Release.
- Source URL: [Official release announcement](https://blog.localstack.cloud/localstack-for-aws-release-2026-08-0/).
- Primary corroboration: [Official release index](https://blog.localstack.cloud/tags/announcement/).
- Summary: LocalStack's AWS emulator adds Lambda Durable Functions and CloudFront Functions backed by KeyValueStore.
  The release also enables its native ELBv2 provider by default and expands several other service emulations.
- Zurich connection: Same qualified LocalStack evidence as above; no claim that the whole distributed team's release was built in Zurich.
- Category: Software release; cloud infrastructure tooling.
- Editorial recommendation: **Reserve**, likely combine editorially with the stronger lstk or Snowflake-Next item rather than fill the feed with three LocalStack updates.
- Confidence: **High** for announcement; **medium** for release-specific local attribution.
- Caveat: Access requires a LocalStack account and applicable plan; avoid presenting current emulator distribution as unrestricted open source.
- Deduplication: No matching item found.

### Unique AI adds row-specific retrieval filters to Agentic Table

- Original publication date: **2026-09-11**, explicitly shown on the company blog.
- Date qualification: This is the publication date of a roundup covering releases 2026.32, 2026.34 and 2026.36, not proof that every feature first shipped on September 11.
- Source title: What's New in Unique AI in September 2026.
- Source URL: [Company release roundup](https://www.unique.ai/en/blog/whats-new-in-unique-ai-september-2026).
- Primary corroboration: [Image-formatting documentation](https://docs.unique.ai/developers/software-development-kit-sdk/advanced-message-formatting/rendering-images-in-chat-messages) corroborates one feature; the linked 2026.36 Atlassian release page failed to load.
- Summary: Unique AI adds per-row metadata filters so Agentic Table can retrieve different document subsets for each row, including date-limited material.
  The roundup also reports image rendering in cells and improvements to document ingestion and large-sheet navigation.
- Zurich connection: The company's [earlier location evidence](https://www.unique.ai/en/blog/unique-secures-usd-30-million-series-a-to-pioneer-agentic-ai-workforce-in-financial-services-2) identifies a Zurich-based operating startup; the [public company profile](https://www.linkedin.com/company/unique-zurich/) was also opened.
- Category: Product update; enterprise AI; retrieval.
- Editorial recommendation: **Consider**, but date the roundup honestly and verify individual release dates before presenting any feature as newly launched inside the window.
- Confidence: **High** for publication date and described changes; **medium** for exact feature-release timing.
- Deduplication: Existing Unique funding coverage does not include this update.

### Threema desktop beta adds screen-capture protection

- Original release date: **2026-09-15**, explicitly shown for Desktop Beta 66 in the official changelog.
- Source title: Threema 2.0 for Desktop Beta 66 / Threema Work 2.0 for Desktop Beta 66.
- Source URL: [Official changelog](https://threema.com/en/changelog).
- Primary corroboration: Both consumer and Work beta entries independently list the capability on the same page; no separate technical security validation obtained.
- Summary: Threema's desktop beta adds protection against screenshots and Windows Recall recording application content.
  It also allows forwarding within the same conversation and fixes an application-update problem.
- Zurich connection: [Company information](https://threema.com/en/impressum) places the team in Pfaeffikon SZ, and an opened [company engineering-role page](https://new.career.threema.com/jobs/8276388-solution-engineer) explicitly calls this the Greater Zurich Area.
- Category: Beta release; privacy; secure messaging.
- Editorial recommendation: **Consider as a compact regional product brief**; identify both the beta status and Schwyz location.
- Confidence: **High** for date and changelog content; **medium** for the scope of screen-capture protection because implementation details were not verified.
- Caveat: Do not claim protection against cameras, compromised operating systems or every capture method.
- Deduplication: No Threema item found.

### Sensirion makes SFA40 globally available

- Original publication date: **2026-09-15**, explicit company-issued EQS release.
- Source title: Sensirion announces global availability of the SFA40 formaldehyde sensor for indoor air quality applications.
- Source URL: [Company release on EQS](https://www.eqs-news.com/news/corporate/sensirion-announces-global-availability-of-the-sfa40-formaldehyde-sensor-for-indoor-air-quality-applications/df8538e7-7587-42db-898c-be3e25f4b360_en).
- Primary corroboration: [SFA40 product page](https://sensirion.com/products/catalog/SFA40).
- Summary: Sensirion makes its miniature formaldehyde sensor available through its global distributor network.
  The sensor provides factory-calibrated digital measurements for air-quality equipment and low-power devices.
- Zurich connection: The release identifies the company's Staefa headquarters in canton Zurich.
- Category: Hardware availability; sensors.
- Editorial recommendation: **Reserve or combine as context with SEN68/SEN69C**, which is the stronger standalone hardware story.
- Confidence: **High** for date and availability announcement.
- Caveat: This is a global-availability milestone, not evidence that the technology was invented or initially unveiled on that date.
- Deduplication: No matching item found.

### DeepJudge and Legora introduce bidirectional knowledge integration

- Original publication date: **2026-08-18**, explicit dateline on the company page and its wire release.
- Source title: DeepJudge and Legora Partner on a Bidirectional Integration to Bring Institutional Intelligence to Collaborative Legal Work.
- Source URL: [Company announcement](https://www.deepjudge.ai/news/deepjudge-and-legora-partner).
- Primary corroboration: [Company-issued release on EIN Presswire](https://www.einpresswire.com/article/934892892/deepjudge-and-legora-partner-to-bring-institutional-intelligence-to-collaborative-legal-work).
- Summary: The integration lets legal teams move selected internal documents into Legora and retrieve precedents through DeepJudge during agent workflows.
  Work created in Legora can then be indexed back into the organisation's search system.
- Zurich connection: [DeepJudge headquarters](https://www.deepjudge.ai/about-us), Zurich.
- Category: Product integration; legal AI.
- Editorial recommendation: **Reserve**, stronger than a routine partnership because concrete bidirectional behaviour is described, but prioritise the September plugin for freshness.
- Confidence: **High** for announcement and date; **medium** for rollout breadth because universal availability is not specified.
- Caveat: The underlying Agent Handoff Protocol was announced on August 13 and is outside this window; do not recast it as an August 18 open-source launch.
- Deduplication: No matching item found.

## Held deployment announcements

These are in-window announcements about future installations, not completed deployments or fresh product launches.

### Loft Dynamics and Pathfinder plan H125 training in Anchorage

- Original publication date: **2026-09-17**, explicitly shown on the company announcement.
- Source title: Loft Dynamics and Pathfinder Aviation make H125 VR simulator training available in Alaska for the first time.
- Source URL: [Company release](https://www.loftdynamics.com/loft-dynamics-and-pathfinder-aviation-make-h125-vr-simulator-training-available-in-alaska-for-the-first-time/).
- Primary corroboration: Public company LinkedIn announcements were discovery leads; no separate customer confirmation was verified.
- Summary: Pathfinder plans to install Loft Dynamics' H125 simulator at its Anchorage base for local pilot training.
  The release expects delivery by the end of 2026 and describes FAA qualification as a later objective.
- Zurich connection: The source lists Loft Dynamics' operating address in Duebendorf, canton Zurich.
- Category: Planned deployment; aviation simulation.
- Editorial recommendation: **Hold for installation**, or use only an explicitly future-tense customer-order brief if the editorial scope includes it.
- Confidence: **High** for the plan and date, not for completion.
- Caveat: A secondary search result claimed installation had already happened, contradicting the primary source; that stronger claim was rejected.
- Deduplication: Loft Dynamics' existing funding brief is unrelated; the general FAA-qualification lead already appears in prior research.

### Kawasaki plans to adopt Loft Dynamics' H145 simulator

- Original publication date: **2026-08-20**, explicit company dateline.
- Source title: Loft Dynamics brings H145 VR training to Asia-Pacific with Kawasaki.
- Source URL: [Company announcement](https://www.loftdynamics.com/loft-dynamics-brings-h145-vr-training-to-asia-pacific-with-kawasaki/).
- Primary corroboration: The release quotes Kawasaki and describes the intended Gifu training centre; no independently opened Kawasaki announcement.
- Summary: Kawasaki commits to the H145 multi-pilot VR simulator for its training centre in Gifu.
  The planned installation supports shared crew training using aircraft systems and flight-dynamics information supplied by Airbus Helicopters.
- Zurich connection: Loft Dynamics' Duebendorf address appears on the source page.
- Category: Planned deployment; VR; aviation engineering.
- Editorial recommendation: **Hold or reserve**, not a completed deployment and not the original simulator launch.
- Confidence: **High** for the dated commitment; completion unverified.
- Caveat: The original H145 commercial launch is linked as July 21, 2026, outside the requested window.
- Deduplication: No exact duplicate found; do not conflate with the existing general FAA-qualification research lead.

## Rejected and unresolved notable leads

The following exclusions prevent stale, weakly local or non-news material from entering the shortlist.

- **DeepJudge Agent Handoff Protocol:** [Original company-issued release](https://www.einpresswire.com/article/933719257/deepjudge-introduces-agent-handoff-protocol-with-harvey-and-thomson-reuters-among-first-to-adopt) was opened and dated **2026-08-13**, outside the window.
- **mimic M1 hand and U1 wearable:** [Original engineering post](https://www.mimicrobotics.com/blog/solving-dexterity-a-full-stack-approach) was opened and dated **2026-07-16**, outside the window, resolving an existing research-queue uncertainty.
- **mimic FLUX-mimic:** Search discovered a company post dated **2026-07-23**; not shortlisted and not independently opened because it is outside the window.
- **ANYbotics manifesto:** [Company article](https://www.anybotics.com/news/anybotics-manifesto/) was opened; **2026-09-09**, but broad company strategy and existing operating scale do not establish a specific new release or deployment.
- **Qmicro DynamiQ-X BG2300:** [September 10 company release](https://www.eqs-news.com/news/corporate/media-release-dynamiq-x-bg2300-fast-and-accurate-biogas-and-biomethane-analysis-in-under-a-minute/55dd3b70-ea15-4f5a-978f-aa2f1de2624e_en) is concrete, but the opened [Qmicro company history](https://www.qmicro.com/company/news/press-releases-and-news/article/sensirion-acquires-micro-gas-analyzer-specialist-qmicro) places development in Enschede, Netherlands.
  Hold under this area's Zurich-team requirement; Swiss parent ownership alone should not turn Dutch engineering into Zurich engineering.
- **Motoko 1.15.0 and 1.15.1:** Opened the [release history](https://github.com/caffeinelabs/motoko/releases) and [1.15.0 release](https://github.com/caffeinelabs/motoko/releases/tag/1.15.0), which describe migration-history validation and compiler fixes.
  Hold because the retrieved GitHub timestamp shows August 28 without a year, and `dfinity/motoko` now redirects to `caffeinelabs/motoko`; neither current local ownership nor a full original date was independently established.
- **ICP MCP:** A September 2 effective date surfaced on [operator terms](https://internetcomputer.org/icp-mcp/app-operator-terms/), but legal terms are not proof of a product launch date; search-only lead, not a verified candidate.
- **Threema Android 6.5.2/6.5.3 and iOS 7.4:** Official changelog confirms September releases, but routine fixes and contact-list changes are weaker than the desktop capture-protection feature.
- **Threema DDoS engineering account:** The opened blog index dates it **2026-08-14**, outside the window.
- **Anapaya appliance 0.41.6:** Search of the official release feed returned **2026-08-03**, outside the window; no in-window launch verified.
- **SonarQube September releases:** Concrete releases surfaced, but official contact evidence identifies Geneva and other offices, not a substantive Zurich engineering team; rejected for geography.
- **turbopuffer September engineering article:** Search found a September 4 guest article, but no meaningful Zurich team connection was established; not shortlisted.
- **LocalStack Azure:** Search found a product page targeting a September preview, but a target month and waitlist do not prove the preview has launched; date unknown, hold.
- **LocalStack WonderTwin acquisition:** Search found a September 14 company-issued announcement; not developed here because ownership transactions are outside the assigned product-and-engineering focus unless a shipped integration is verified.
- **NEURA/SECO and NEURA/ADLATUS:** Company newsroom search surfaced September 7 partnership and August 24 acquisition announcements, but neither was tied to the Zurich development site's work; not promoted into this area's shortlist.
- **Voliro Monti Drone/Aeroblaster:** Public LinkedIn search surfaced a September 8 webinar about the joint work, not a securely dated original launch; hold the technology lead and classify the webinar as **events-only**.
- **Tethys ONE:** Search surfaced February 2026 demonstrations and an August social post explicitly saying Tethys was not involved in the recent Limmat grenade incident; no in-window product or deployment announcement verified.
- **DACH CIO gathering, WalkMe Zurich roadshow, Launch Live and co-founder matchmaking:** Public LinkedIn discovery only; **events-only**, not product launches or presently verified useful open calls.
- **Alpine Tech Forum / tokenisation report:** Discovery gives an event date of **2026-09-29**, beyond the cutoff; exclude as future and **events-only**, with social publication date unverified.
- **ETH/IBM quantum system, airport shuttles and Aionic Labs:** Already present as shortlisted or unresolved prior research; avoid duplicating them here and do not resolve their operational/date caveats by inference.
- **Apertus:** Existing brief is dated **2025-09-02**, not September 2026; already covered and outside the window.
- **Gravis and xorlab financing:** Already covered according to repository/user context and expressly outside this research area's funding exclusion.

## Search coverage

The following is a record of sources actually searched or inspected, not a claim of exhaustive monitoring.

| Source family                 | Scope and result                                                                                                                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scandit                       | Opened blog, dated launch, technical explainer, product page and company location page; retained loss-prevention launch.                                                                                                           |
| Sensirion / EQS               | Opened three dated company releases and SEN68, SEN69C and SFA40 product pages; retained two sensor stories and held Qmicro for geography.                                                                                          |
| PSI / Metafuels               | Opened PSI announcement and language version; searched Metafuels newsroom and technology pages; retained demonstration plant.                                                                                                      |
| DeepJudge                     | Opened company newsroom, two integration announcements, company profile and three corresponding wire releases; excluded August 13 protocol release.                                                                                |
| Microsoft VS Code / GitHub    | Opened stable release notes, GitHub release and engineering coordination issue; verified direct Zurich team involvement.                                                                                                           |
| KNIME                         | Searched blog, release index and forum; opened Business Hub release notes, architecture and headquarters page.                                                                                                                     |
| LocalStack                    | Opened company release index, lstk launch, AWS release, Snowflake preview, company page and legal address; local feature attribution remains qualified.                                                                            |
| Unique AI                     | Opened release roundup, public company profile, older company location evidence and feature documentation; a linked detailed release page was inaccessible.                                                                        |
| Threema                       | Opened blog, changelog, legal notice, engineering role and Android GitHub release page; retained desktop beta, rejected routine changes.                                                                                           |
| DFINITY / Motoko              | Searched forum and MCP terms; opened redirected compiler releases; date and current team attribution left unresolved.                                                                                                              |
| Robotics                      | Opened ANYbotics newsroom and manifesto, Loft Dynamics releases and mimic engineering post; searched Sevensense, Tethys, Voliro, RIVR, Flexion and NEURA.                                                                          |
| Other engineering teams       | Searched Anapaya, Zurich Instruments, Sonar, Snyk, prefix.dev, Hexagon and turbopuffer; no further verified qualifying candidate.                                                                                                  |
| Public LinkedIn               | Searched company/founder announcements and local launches; inspected Unique's public profile and used Loft, Voliro and Tethys results as discovery only where not opened.                                                          |
| Discovery press / directories | Search results included Startupticker-related roundups, startupnews.ch, Leitgrad, startup.ch, StartupBlink, technical press and syndicated company releases; no discovery-only snippet is treated as a verified shortlisted story. |

## Access and evidence limitations

Search coverage is incomplete, especially for small teams, unindexed engineering blogs and public LinkedIn posts.
LinkedIn relative ages and search-engine crawl dates were not converted into invented publication dates.
Some search results had inconsistent freshness metadata; explicit source-page dates took precedence.
The attempted Metafuels `/news/` page, federal mirror of the PSI announcement, WBOC DeepJudge syndication, Unique `/about` page and linked Atlassian release page returned retrieval errors.
DeepJudge's engineering job page produced no usable body on opening, so its search snippet was not used as verified local-team evidence.
GitHub rendered partial loading errors and omitted years on some release dates; VS Code's date was independently corroborated, Motoko's was not.
The opened Threema Android GitHub releases page said there were no releases there; the official changelog supplied verified release facts instead.
No login, paywall bypass, installation, benchmark, customer contact or private account access was attempted.
No independent customer testing was available for vendor performance, security or availability claims.
Commercial readiness, licence terms and preview restrictions are not interchangeable with a dated announcement.
The strongest immediate selection is Scandit, Sensirion SEN68/SEN69C, DeepJudge's plugin, KNIME Business Hub 1.19, VS Code 1.139 and the Metafuels demonstration plant.
