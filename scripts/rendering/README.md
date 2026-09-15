# Rendering

Render complete public HTML with SolidStart's `mode: "async"`.
Hydration adds navigation, filters, maps and account controls to that HTML.
Keep private account data browser-scoped until server authentication is implemented deliberately.

## Streaming failure, 15 September 2026

The original production build returned HTTP 200 while leaving the page on Loading.
The same failure reproduced locally with Solid 1.9.14, SolidStart 1.3.2 and Wrangler 4.112.0's Cloudflare runtime.
The response contained resolved HTML templates but could lose the final scripts and resource resolutions needed to reveal them.
Instrumentation confirmed that Solid generated and queued the missing output before closing the stream.

Solid's `renderToStream().pipeTo()` releases its writer and closes the underlying writable immediately after enqueueing output.
In this runtime, releasing the writer loses queued writes.
The fault reproduces without Solid, application code, authentication or network requests:

```js
export default {
    async fetch(request) {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();
        writer.write(encoder.encode("first\n"));
        writer.write(encoder.encode("last\n"));
        if (new URL(request.url).pathname === "/correct") {
            writer.close();
        } else {
            writer.releaseLock();
            writable.close();
        }
        return new Response(readable);
    },
};
```

The original sequence returned an empty body.
Closing through the writer returned `first\nlast\n`.
Replacing only this close sequence in an isolated copy of the built application retained the final scripts in six consecutive requests and restored browser rendering.
The checked npm release of Solid 1.9.15 still contains the original close sequence.
This establishes the Solid writer/Cloudflare runtime interaction; it does not establish which implementation violates the Streams specification.
No dependency patch is installed in this project.

Complete rendering avoids this streaming adapter and also makes the public page available without JavaScript.
An early Loading shell is not the performance target; completed useful content is.

## Performance changes

Start the map and sponsor requests alongside the homepage's calendar, news, directory, jobs and photos.
Preload the shared topic catalogue and reuse it in news resolution and event labels, removing a duplicate request after the gallery resolves.
Read all published news from Convex through the same public query model; Markdown exists only as an import source.
Serialize only the requested news article on detail routes instead of serializing the full archive and then the article again.
Read independent photo albums concurrently, preserving ordering, moderation and the five-photo limit.

The full archive remains available to news filtering and the rotating gallery retains all albums.
The gallery query now uses finished status rather than a unique current-time argument.
The development backend has been updated; production must receive this query API change before the new frontend is deployed.

## Verification

Run the production build against its intended Convex deployment, then preview it with Wrangler.
Check the actual response bodies before browser JavaScript can hide a rendering failure:

```sh
bun scripts/rendering/check.ts http://localhost:3006
bun scripts/rendering/check.ts http://localhost:3006 /news/introducing-zurich-tech
```

The check rejects HTTP errors, missing main content, rendered error pages and unresolved server fragments.
It deliberately rejects streaming HTML even if JavaScript could eventually reveal it.
It detected the original streaming response and passed the complete-rendering preview across the eight default routes.
Also verify direct entry, client navigation, Back, reload, a missing article's 404 status and browser console errors.

The investigation's local warm homepage samples were 262–311 ms to response headers.
Other local public routes were 55–145 ms after warmup; the first homepage request was 810 ms.
Production samples before these performance edits were 679–933 ms for the homepage.
These are different environments and data sets, not a before/after speedup claim.
An isolated copy of the same local build took 307 ms with live Convex responses and 17–23 ms when rerendering with their buffered bodies reused.
Both paths returned complete homepage HTML with the event content present.
The live sample included a 233 ms gallery request and a subsequent 52 ms topic request.
After sharing and preloading topics, instrumentation recorded only one topic request; total time still varied with backend latency.
This diagnostic separates backend wait from rendering; its response reuse is not a production cache implementation or a production latency guarantee.
The complete news detail response was 162,593 bytes before compression and contained no unrelated authored article.
The browser build contained no authored archive module.
All 69 unit/integration tests passed, including gallery ordering, publication filtering and public cache isolation/error handling.

## Further optimization boundaries

The framework injects roughly 135 KB of route manifest before compression on every document.
Externalizing it would require a supported framework change or a custom document pipeline; do not replace SolidStart internals just to reduce an uncompressed number.
Measure compressed transfer and browser work before making that tradeoff.

## Public snapshots and live views

`publicQuery` defines the Convex reference, arguments and projection once.
Its callable form supports router preloading; `.use(() => args)` supplies a view with hydrated data and a live subscription.
Passing `undefined` to `.use` disables a conditional view's subscription.
The application `PublicProvider` owns one anonymous Convex client, shared with search, and closes it with the application.
Each view releases its subscription on disposal or argument changes.
Live values take precedence over a slower snapshot response, so a late HTTP response cannot replace newer subscribed data.

The read paths are:

```text
Initial document
  router preload → publicQuery → Cloudflare Cache API → anonymous Convex HTTP query on miss
  complete HTML + serialized query results → hydration

Open view
  publicQuery.use → shared ConvexClient → subscription updates → view
  view disposal → unsubscribe

Private workspace
  memberClient → authenticated request; no public cache
```

Only public query results are cached, not HTML, cookies, authentication or drafts.
Cache keys include the build, backend deployment, query function and arguments.
Successful values expire after 30 seconds; query failures are never cached.
The browser subscription bypasses this cache and applies database changes as Convex delivers them.
Authored news remains in the server build, while its displayed published posts and topic labels update live.
Plain development rendering without the Worker Cache API uses fresh reads.
Cloudflare stores these snapshots per data centre; a cold or expired entry still pays the backend cost.
There is no immediate global purge promise for initial HTML; the bound is the snapshot lifetime.
`Server-Timing` headers distinguish public cache hits and misses.

A local built homepage returned in 27 ms with nine public cache hits, versus 599 ms for a preceding request with misses.
These are local wall times, not production latency guarantees.
A development topic-label change appeared on the open news page without a reload.
After restoration, the browser displayed the restored label while a cache-hit HTML response still contained the previous value; after expiry, initial HTML also contained the restored label.
The temporary mutation was removed from the development backend and the original label restored.
Direct HTML checks passed on the eight public routes, and browser checks passed news/event navigation and Back without console errors.

## Review: public query ownership

Public subscriptions bind their result or error to the same argument key as the server snapshot.
Changing or disabling a query disposes its subscription and rejects late callbacks.
Successful updates replace previous errors.
News detail uses an indexed single-post query; list and detail share the same public projection.
The frontend deployment therefore requires the new news detail function as well as the gallery query on its backend.
Cache storage failures return a fresh backend result and are logged; backend failures remain errors and are not cached.

The review passed 71 tests, type checking, a production build, eight completed-HTML route checks, and an article-to-events browser Back check without console errors.
These checks used the development backend and the built preview on port 3006.
No production deployment is implied by these results.

### Scheduled sponsorship recognition

Public recognition is materialised on each sponsorship and updated at the next relevant agreement or payment date.
Agreement changes, payments and full refunds recompute recognition and its next scheduled transition.
Superseded tasks check the stored transition date and cannot undo amended terms.
Run `sponsorships/recognition:rebuild` once on each deployment to initialise existing agreements before deploying the frontend.
The scheduled database updates invalidate live queries; the public HTML snapshot still has its bounded 30-second cache lifetime.

### Release order

Deploy backend functions, import the reviewed news into that deployment, initialise sponsorship recognition, then deploy the website.
The news importer defaults to a dry run and rejects conflicting edits.
No generated article module or parallel file-based runtime remains.
