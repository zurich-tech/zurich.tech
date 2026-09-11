# Social covers

Use the PNG named for the destination.
Each `-map.png` version omits the wordmark.

| File                   | Dimensions  | Use                          |
| ---------------------- | ----------- | ---------------------------- |
| `linkedin-profile.png` | 1584 × 396  | Personal LinkedIn background |
| `linkedin-page.png`    | 4200 × 700  | Organisation LinkedIn cover  |
| `x.png`                | 1500 × 500  | X profile header             |
| `landscape.png`        | 1920 × 1080 | General landscape cover      |

The map uses the hero palette and Zürich geography, without markers or controls.
The wordmark is the same outlined SVG used by the website, derived from its bundled JetBrains Mono font at weight 800.
Map credits are documented below and on the website’s Legal page.
The exported artwork contains no attribution overlay.

Regenerate with `bun scripts/branding/covers.ts`.
This fetches the current OpenFreeMap tiles and requires network access.

Dimension sources: [LinkedIn profiles](https://www.linkedin.com/help/linkedin/answer/a568217/adding-or-changing-the-background-photo-on-your-profile?lang=en), [LinkedIn Pages](https://www.linkedin.com/help/linkedin/answer/a570367/especificacoes-de-imagem-para-linkedin-pages-e-career-pages?intendedLocale=pt&lang=en-us), [X](https://help.x.com/en/managing-your-account/common-issues-when-uploading-profile-photo).
Map data: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [OpenMapTiles](https://openmaptiles.org/), [OpenFreeMap](https://openfreemap.org/).
