# Mail and Statistics Migration

This conversion changes stored records and requires a maintenance window.
It also rebuilds published organisation news previews from the `posts` table.
Do not deploy the final schema onto unmigrated records.
Do not run old application functions after importing the new records.

## Rehearsal

1. Use an isolated development deployment with delivery credentials removed and `MAIL_RECIPIENTS` set to an empty string.
2. Pause the deployment and wait for running actions to finish.
3. Restore an unmodified backup with `convex import --replace` and wait for completion before changing the schema.
4. Export a new backup and extract it into a private directory outside the repository.
5. Run `bun scripts/migrations/mail.ts <extracted-backup> <new-private-output-directory>`.
6. Compare the conversion report and run the migration tests before importing anything.
7. While paused, deploy a temporary schema that accepts both the old and new record shapes, retaining every index and every existing table.
   Add optional `text` and `html` fields to `messages`; optional `message`, `content` and `recipients` fields to `campaigns`; and optional `deliveredAt` and `hasDeliveryFailure` fields to `subscriptions`.
   Keep schema validation enabled.
8. Import each generated `<table>.jsonl` with `convex import --replace --table <table>`.
   Finish each import before starting the next import or schema deployment.
   These files preserve existing record IDs and creation times.
   New content and aggregate rows receive new IDs and refer to the preserved message, campaign and event IDs.
9. Deploy the final application and strict schema while the deployment remains paused.
10. Export the converted tables and compare their records with the prepared files, ignoring newly allocated system fields on new tables.
    Include `newsMentions`; verify that withdrawn stories have no public mentions.
11. Resume the development deployment, verify campaign previews, member history, calendar counts and registration changes, and run simulated mail delivery with the provider disabled.

## Production

Repeat the rehearsed sequence only after explicit approval of the maintenance window.
Take the backup after pausing, so registrations, consent changes and provider reports cannot race the conversion.
Keep the deployment paused if any import, comparison or schema validation fails.
Restore the original backup and application before resuming if rollback is required.
Do not increase rates, create replacement campaigns, clear attempts or reset approvals.

Old scheduled bulk jobs cannot claim delivery under the new application.
The singleton dispatcher recovers queued work through the existing consent, quota and approval checks.
Provider idempotency keys, acceptance timestamps, outcomes, recipient order and campaign approvals remain unchanged.
Check for an approval that expired during maintenance before deciding whether to resume an affected campaign.

Convex documents that [paused deployments block function calls while retaining data and scheduled jobs](https://docs.convex.dev/production/pause-deployment).
Its [JSONL import preserves supplied IDs and replaces only the named table](https://docs.convex.dev/database/import-export/import).
Verify imports while paused in the rehearsal before using this procedure in production.
