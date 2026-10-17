# Rendering

Render complete public HTML with SolidStart's `mode: "async"`.
Hydration adds navigation, filters, maps and account controls to that HTML.
Keep private account data browser-scoped until server authentication is implemented deliberately.

Complete rendering avoids a reproduced Solid streaming-writer failure in the Cloudflare runtime that returned HTTP 200 while leaving pages on Loading.
Do not restore streaming without verifying complete response bodies in the built Worker.

## Public Queries

`publicQuery` defines the Convex reference, arguments and projection once.
Its callable form supports router preloading; `.use(() => args)` supplies hydrated data and a live subscription.
Passing `undefined` disables a conditional subscription.
The application `PublicProvider` owns one anonymous Convex client and closes it with the application.
Each view releases its subscription on disposal or argument changes and rejects late callbacks.
Live values take precedence over slower snapshot responses.

Successful public query results expire after 30 seconds, with keys isolated by build, backend, query and arguments.
Backend failures remain errors and are never cached; cache-storage failures are logged and return fresh backend results.
Plain development rendering without the Worker Cache API uses fresh reads.
The separate public HTML cache has a longer lifetime; see [deployment notes](../deployment/README.md#public-page-cache) for its rules.
Neither cache stores private account results or drafts.
Private workspaces use authenticated clients outside the public cache.

## Verification

Build against the intended Convex deployment and preview the built Worker before release.
Check response bodies before browser JavaScript can hide a rendering failure:

```sh
bun scripts/rendering/check.ts http://localhost:3006
```

The check rejects HTTP errors, missing main content, rendered error pages and unresolved server fragments.
It also verifies transitive module dependencies, asset content types and cache headers.
Check direct entry, client navigation, Back, reload, missing-article 404 responses and browser console errors.
Deploy backend changes before the frontend, maintaining compatibility with already-open browser clients.
