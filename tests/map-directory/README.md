# Map directory regression

This browser fixture mounts the real `MapDirectory` with a deterministic catalogue of 1,600 organisations.
It requires no backend credentials and makes no production writes.

## Run

From the repository root, start the fixture with the installed dependencies:

```sh
bunx vite --config tests/map-directory/vite.config.mjs
```

Open <http://127.0.0.1:5189/> and select **Run regression**.
Wait for **PASS** and confirm that the error count remains zero and the browser console has no errors.
The fixture exercises incremental ETH searches, empty results, reordered and replaced records, selection/hover updates, and focus restoration across virtual rows.
It runs both frame-separated updates and updates faster than measurement.

If port 5189 is occupied, use a separate port without stopping another reviewer's server:

```sh
bunx vite --config tests/map-directory/vite.config.mjs --port 5191
```

Open the corresponding localhost URL.
Stop the fixture with Ctrl+C when finished.

## Scope

This is a mounted browser regression, not part of `bun test` and not a full-map WebGL test.
Also check repeated typing/deletion, zero results, and keyboard navigation on `/map` before deploying directory changes.
