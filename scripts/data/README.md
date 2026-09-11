# Reviewed community data

These manifests contain public content updates for this release.
Both default to `apply: false` and use stable event and organisation slugs, so database IDs are resolved in the target deployment.
They do not send email, change registrations, or create payments.

- `event-backfill.json`: five event descriptions and the verified links for 80 speakers, including their repeated appearances.
- `eth-ai-center-location.json`: the ETH AI Center map symbol and Oerlikon address, resolved from the ZurichNLP #22 venue.

## Rollout

Deploy Convex and the frontend first; the frontend supplies the ETH symbol asset.
Pushing `main` runs the existing CI deployment in that order.
After the deployment succeeds, preview both production changes:

```sh
bunx convex run --prod events:backfill "$(cat scripts/data/event-backfill.json)"
bunx convex run --prod organisations:importLocation "$(cat scripts/data/eth-ai-center-location.json)"
```

Review the output before applying.
For the approved apply step, pass the same JSON with `apply` changed to `true`; leave the checked-in manifests in preview mode.
Repeat the previews after applying: both should report no remaining changes.
Omit `--prod` when checking development.

The additional ZurichRobotics #5 photo candidates are not part of this release: publishing those images to shared public storage still needs approval.
Stripe, Resend, X sign-in and the full Wix migration are separate launch work.

## Tufa series consolidation

`tufa-series.json` moves the old Tufa AI Meetup events and editable revisions into Tufa Talks, then deletes the duplicate series.
Development has been updated; production still needs this migration during rollout.
Preview with `bunx convex run --prod series:merge '{"from":"tufa-ai-meetup","into":"tufa-talks","apply":false}'`.
After reviewing, use the same arguments with `apply: true` for the approved production rollout.
