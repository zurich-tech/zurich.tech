# Client assets across deployments

Deploy through the production workflow so asset retention and verification run alongside the build.
Production runs finish in order; only superseded pull-request checks are cancelled.
The backend is deployed before the website, so API and schema changes must remain compatible with older browser clients.

The archive keeps the current build and thirty days of replaced assets, including JavaScript, styles, fonts and workers.
The retention window begins when a build is replaced, not when it was originally built.
On the first run without an archive, public assets are collected from the live module graph before deployment.
A failed download or changed content under an existing asset URL stops the deployment.
The archive is saved after a successful Worker deployment and retained in GitHub for ninety days.

Run `bun scripts/rendering/check.ts <origin>` against the built Worker before release and against production afterward.
It verifies server-rendered pages, transitive module dependencies, JavaScript/CSS content types, document revalidation and uncached missing-file responses.
Old tabs beyond the retention period can require a manual reload; do not automatically reload editors or bypass their unsaved-change guards.
