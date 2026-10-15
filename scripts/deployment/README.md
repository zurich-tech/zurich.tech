# Client assets across deployments

Deploy through the production workflow so asset retention and verification run alongside the build.
Production runs finish in order; only superseded pull-request checks are cancelled.
The backend is deployed before the website, so API and schema changes must remain compatible with older browser clients.

The archive keeps the current build and thirty days of replaced assets, including JavaScript, styles, fonts and workers.
The retention window begins when a build is replaced, not when it was originally built.
On the first run without an archive, public assets are collected from the live module graph before deployment.
A failed download or changed content under an existing asset URL stops the deployment.
The archive is saved after a successful Worker deployment and retained in GitHub for ninety days.
Old tabs beyond the retention period can require a manual reload; do not automatically reload editors or bypass their unsaved-change guards.

Run `bun scripts/rendering/check.ts <origin>` against the built Worker before release and against production afterward.
It verifies server-rendered pages, transitive module dependencies, JavaScript/CSS content types, document revalidation and uncached missing-file responses.

## Public Page Cache

The Worker entrypoint caches anonymous public HTML before invoking the Solid renderer.
Documents are fresh for one hour, then served for up to five more minutes while refreshing in the background.
Cloudflare version metadata isolates each deployment's cache, including its client-module references.
Browsers still revalidate; authenticated requests, cookies, query strings, private routes and unsuccessful responses bypass storage.
Live public subscriptions refresh the initial snapshot after hydration, and mutations always enforce current backend rules.
`X-Page-Cache`, `X-Page-Age` and `Server-Timing` distinguish rendering from cache hits.
The first request in a Cloudflare location still renders normally, and cache eviction can cause an earlier miss.

## Public Reads

Programme and series pages use the series-only query, not the full organisation directory.
Organisation detail pages read one indexed organisation and its public locations.
Homepage and related-news previews omit article bodies; archive search still reads full articles.
The search catalogue starts when a search view first needs it and stays subscribed for subsequent navigation.
Public query cache writes use the Worker's request lifetime instead of delaying rendered HTML.
Keep route reads concurrent, public snapshots anonymous, and private reads gated by the current account.

## Browser Loading

Preload only the two shared Latin fonts, using the same hashed assets as the stylesheet.
Establish the public backend connection early, decode images asynchronously and lazy-load directory thumbnails.
Map markers appear immediately with initials, then upgrade independently as logos finish loading.
Do not defer visible page content or make the map wait for every logo.

## Public Logo Headers

Organisation logos are public PNGs under `https://media.zurich.tech/organisations/`.
Both HTML images and map canvases request these assets anonymously so they can share cached responses.
The image server must return `Access-Control-Allow-Origin: *`, including when a request has no `Origin` header.

`media-headers.json` defines the Cloudflare response-header transform for these public assets only.
Install it in the zone's `http_response_headers_transform` ruleset, preserving other rules.
This is infrastructure configuration: the website deployment does not install or update it.
`media-cors.json` is the bucket's origin-specific CORS configuration; it does not replace the edge rule for cached responses.

Before deploying logo-loading changes, check a real hosted logo with a normal GET, an `Origin: https://zurich.tech` GET and a conditional request.
Confirm successful image responses include the wildcard header, have an image content type and decode correctly.
Test the logo in both an HTML image and the map canvas in Chrome.
If the header is absent, fix the media configuration before release; the client's single cache refresh cannot repair missing server headers.
