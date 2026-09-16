# Email

Templates and layout live in code.
Campaign subject and message text live in Convex and are edited through the admin UI.

## Model

The email domain owns these records:

- `campaigns`: audience rule, frozen content, schedule, lifecycle and aggregate progress.
- `messages`: one rendered email, source recipient, attempt state and provider result.
- `subscriptions`: consent, preferences, suppression and consent history.
- `deliveryEvents`: signed provider reports, deduplicated by provider event ID.
- `mailPolicy`: pause and sending profile.
- `mailQuota`: pacing, daily usage and delivery health counters.
- `mailSchedules`: weekly newsletter pause and last edition.

`audiences.ts` selects subscribers or event registrations independently of message purpose.
`campaigns.ts` owns group sends; product modules create campaigns through `create`.
`messages.ts` owns delivery and retries; `sending.ts` owns shared limits and dispatch.
`provider.ts` owns the Resend request and headers, shared with sign-in codes.
`personalization.ts` resolves code-owned private URLs once before storing a message.
`templates.ts` and `layout.ts` render both product and written emails.
Individual confirmations use messages directly; sign-in codes are sent without being retained.

## Membership

New verified account signups, event registrations and explicit subscriptions enable all four email preferences.
Account signup and registration preserve existing preferences, opt-outs and suppression.
Explicit subscription confirmation enables all preferences again, but cannot bypass suppression.
Public member totals and history count active community subscriptions, independently of weekly delivery preferences.
Event confirmations alone do not count as community subscriptions.
Accounts, profiles and attendance remain when someone unsubscribes.

## Lifecycle

Written campaigns start as drafts.
Sending confirms the saved revision and current eligible recipient count.
Content freezes at confirmation; recipient membership freezes when sending starts.
Scheduled campaigns therefore include the audience eligible at their scheduled time.
Each recipient is rechecked for consent and registration state immediately before sending.

Campaigns can be scheduled, paused, resumed or cancelled.
Pausing retains the audience, content, attempts and progress.
Cancellation stops unsent work; messages already being sent cannot be recalled.
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

Sending profiles raise daily and hourly ceilings on active sending days, never idle days.
Attempts and retries share the same atomic quota.
Changing policy does not replenish quota.
Switch profiles while paused, then resume explicitly.

## Delivery reports

Resend posts signed delivery, bounce, complaint, failure and suppression reports to `/mail/webhook`.
`RESEND_WEBHOOK_SECRET` belongs to that deployment.
The endpoint verifies original bytes and timestamps and handles reports arriving before acceptance is stored.
Permanent bounces, complaints and provider suppression prevent later sends to that address.
Temporary bounces record failure without permanently suppressing the recipient.
A complaint, or at least three hard bounces at 2% or more, pauses bulk delivery.
Explicit resume resets health counters; suppression and history remain.
RFC 8058 unsubscribe changes consent only on POST; GET opens the confirmation page.

## Production controls

Warmup profiles, hourly pacing and delivery-health stops are permanent production controls.
The `complete` profile retains fixed limits after warmup.
The development recipient allowlist is independent of these controls and is unset in production.
Campaign test sends remain available for reviewing an email without enrolling its audience.

Bulk delivery (`mailPolicy.isPaused`) and weekly scheduling (`mailSchedules.isPaused`) are separate database controls.
Both remain paused until explicitly enabled through Admin → Email → Settings and Newsletter respectively.
Deploying code does not enable either control.
