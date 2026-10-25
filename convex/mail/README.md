# Email

Templates and layout live in code.
Campaign subject and message text live in Convex and are edited through the admin UI.

## Model

The email domain owns these records:

- `campaigns`: audience rule, frozen content, schedule, lifecycle and aggregate progress.
- `messages`: one rendered email, source recipient, attempt state and provider result.
- `subscriptions`: consent, preferences, suppression and consent history.
- `deliveryEvents`: signed provider reports, deduplicated by provider event ID.
- `mailPolicy`: global pause, its reason and the approved daily attempt total.
- `mailQuota`: pacing, daily usage, the reviewed daily ceiling and delivery health counters.
- `mailSchedules`: weekly newsletter pause and last edition.

`audiences.ts` selects subscribers or event registrations independently of message purpose.
`campaigns.ts` owns group sends; product modules create campaigns through `create`.
`messages.ts` owns delivery and retries; `sending.ts` owns shared limits and dispatch.
`provider.ts` owns the Resend request and headers, shared with sign-in codes.
`personalization.ts` resolves code-owned private URLs once before storing a message.
`templates.ts` and `layout.ts` render both product and written emails.
Individual confirmations use messages directly; sign-in codes are sent without being retained.

## Presentation

Every template uses the same masthead, content width, typography, primary action and footer.
Registration verification and status updates share the same event panel.
Verification places the action before the expiry notice, followed by Discord and volunteer links.
It does not infer account state, share private verification links or add sponsor and job listings before confirmation.
Sign-in codes and operational notices remain focused on their immediate purpose.
Invitations, confirmed registrations, reminders, thank-you messages, series announcements, written campaigns and newsletters include participation links, sponsors and jobs when available.
Jobs follow sponsors, with at most two jobs per organisation.

## Membership

New verified account signups, event registrations and explicit subscriptions enable all four email preferences.
Account signup and registration preserve existing preferences, opt-outs and suppression.
Explicit subscription confirmation enables all preferences again, but cannot bypass suppression.
Public member totals and history count active community subscriptions, independently of weekly delivery preferences.
Event confirmations alone do not count as community subscriptions.
Accounts, profiles and attendance remain when someone unsubscribes.

## Lifecycle

Written campaigns start as drafts.
Sending confirms the saved revision and exact eligible subscriber identities.
For subscriber campaigns, Send or Schedule freezes content and recipients and records one administrator's approval for the chosen Zurich calendar day.
The approval caps attempts at the reviewed recipient count, including retries, and sets a campaign-specific hourly pace.
New subscribers do not enlarge an already approved campaign.
Event-organiser transactional campaigns retain their audience selection at the scheduled start.
Each recipient is rechecked for consent and registration state immediately before sending.

Campaigns can be scheduled, paused, resumed or cancelled.
Pausing retains the audience, content, attempts and progress.
Cancellation stops unsent work; messages already being sent cannot be recalled.
For newly approved event announcements, cancellation or approval expiry releases never-attempted recipients for a replacement campaign.
Attempted recipients remain excluded from subsequent announcements for that event.
Written campaigns can be duplicated into new drafts.
Tests go only to the authenticated verified account and still respect the recipient allowlist.
Test messages retain campaign history but never advance campaign counters or completion.

Message status is `queued`, `accepted`, `failed` or `skipped`.
Temporary failures stay queued with a due time and error.
Five failed attempts are terminal; provider outcomes such as delivery or a bounce are separate.
Retries reuse the same provider idempotency key and never regenerate content.
Interrupted attempts older than 20 hours require provider reconciliation before another send.
Automatic reminders and follow-ups retain their product keys to prevent duplicate manual sends.

## Admin UI

`src/mail/workspace.tsx` separates Campaigns, Newsletter and Settings.
Campaigns owns composition, previews, confirmed sending and message history.
Newsletter shows the automatic schedule and next edition.
Settings owns sender readiness, pace and the global pause.
Event organisers use the same campaign component scoped to their event.

## Access

Global campaigns require an administrator.
Event campaigns require organiser access to that event, including inherited series access.
Event organisers can address confirmed registrations, waitlists, active registrations or checked-in attendees.
They cannot change an event campaign into a subscriber campaign or another event's campaign.

## Controls

These controls are independent:

- `MAIL_RECIPIENTS`: comma-separated allowlist, enforced on every provider send.
  An empty value allows nobody; an absent variable removes the restriction.
  The UI cannot remove it.
- `mailPolicy.isPaused`: holds subscriber campaigns, newsletters and announcements, including retries.
  Missing policy means paused.
  Transactional confirmations and event notices do not consume the bulk quota.
- `mailSchedules.isPaused`: controls newsletter creation, Monday 08:00 Europe/Zurich.
  Missing schedule means paused; empty editions are skipped.
- Campaign pause: holds that campaign's remaining messages.

The initial daily pace is 500, with no automatic increases.
An administrator approves each new subscriber campaign once through Send or Schedule, without a separate daily approval or manual batch releases.
Campaign approval applies only from its start time until Zurich midnight on its approved day.
Expired unfinished campaigns pause for review; resuming cannot extend their approval or replenish attempts.
Shared daily and hourly limits still apply, and a lower campaign pace cannot increase the shared pace.
The current scheduler-created newsletter edition sends automatically without daily approval.
News includes at most five published stories dated Monday through Sunday before the edition, newest first.
The preview uses the approaching Monday's week; on Monday it uses that day's edition.
Story dates retain their original UTC calendar dates, while the edition's day follows Europe/Zurich.
Older backfills never fill a quiet week, and an empty news section is omitted.
Only the `weekly` campaign with the exact `digest:<lastWeek>` key recorded by `mailSchedules` qualifies, and expired editions do not qualify.
Legacy campaigns without their own approval retain their existing daily-approval and batch controls in the backend.
They are not migrated, expanded or resumed by deploying this change; the normal admin UI no longer releases additional batches.
Approving a new campaign never authorises an unrelated legacy queue.
A new complaint pauses bulk delivery when the complaint rate reaches 0.08%, halving the pace with a floor of one attempt per day.
The hourly limit is configured independently from the shared daily ceiling.
Older quotas without an explicit hourly limit retain their original eight-hour pacing.
Saving limits does not approve campaigns, resume delivery or reset usage and health.
A complaint-rate stop also halves an explicitly configured hourly limit.
Attempts and retries share the same atomic quota.
Pausing and resuming does not replenish quota.

## Delivery reports

Resend posts signed delivery, bounce, complaint, failure and suppression reports to `/mail/webhook`.
`RESEND_WEBHOOK_SECRET` belongs to that deployment.
The endpoint verifies original bytes and timestamps and handles reports arriving before acceptance is stored.
Permanent bounces, complaints and provider suppression prevent later sends to that address.
Temporary bounces record failure without permanently suppressing the recipient.
The complaint rate uses provider-accepted bulk messages from the last seven Zurich calendar days, never planned recipients or retry attempts.
Daily `mailHealth` cohorts keep this calculation bounded; complaints are attributed to the original send date and callbacks are deduplicated.
Messages accepted before cohort tracking was introduced remain suppressible but are excluded from these cohorts.
Every recent complaint is visible in Admin, even below the stop threshold.
Bounce rates do not pause delivery or change its pace.
Resuming delivery does not erase complaint cohorts.
Explicit resume resets health counters; suppression and history remain.
RFC 8058 unsubscribe changes consent only on POST; GET opens the confirmation page.

## Production controls

Explicit campaign approvals, shared limits, hourly pacing and complaint stops are production controls.
Campaigns group recipients by registrations in the last 90 days, last year, earlier, or none.
Within each group, distinct event count sorts first, then real activity recency and stable identity ties.
Cancelled and declined registrations do not contribute; email and member identity both match historical records.
Registration activity is capped at the event date to avoid treating imported old events as new interest.
Administrators can preview cohort counts and the first 100 recipients before queueing; this is a preview sample, not a sending batch limit.
The development recipient allowlist is independent of these controls and is unset in production.
Campaign test sends remain available for reviewing an email without enrolling its audience.

Bulk delivery (`mailPolicy.isPaused`) and weekly scheduling (`mailSchedules.isPaused`) are separate database controls.
Both remain paused until explicitly enabled through Admin → Email → Settings and Newsletter respectively.
Deploying code does not enable either control.
