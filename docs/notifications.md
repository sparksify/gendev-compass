# Notification Layer

How GenDev Compass decides that investor activity is worth interrupting a
human for, and what it does about it.

The design goal is not "send notifications" — it is **avoid notification
overload**. Almost everything an investor does is recorded and shown on the
dashboard without sending anything. Only a handful of events reach an inbox.

## Architecture

```
USER ACTION
   ↓  route handler / service
recordLeadEvent()                    lib/domain/activities.ts
   ↓  writes portal_events + activity_events
resolveNotificationRule()            lib/notifications/rules.ts
   ↓  immediate_email? dashboard_only?
dispatchNotificationsForEvent()      lib/notifications/dispatch.ts
   ↓  claim dedupe key → resolve recipient → render → send
notification_deliveries              one row per attempt, incl. failures
```

Three properties hold by construction:

- **Pages and routes contain no email logic.** They record an event and
  return. Whether that event notifies anyone is not their concern.
- **Policy lives in one file.** `lib/notifications/rules.ts` is the only
  place that decides what is worth an email.
- **Notification can never break an investor's flow.**
  `dispatchNotificationsForEvent` does not throw, and every failure path
  leaves a `notification_deliveries` row explaining itself.

### Why it hooks into `recordLeadEvent`

Every meaningful action already funnels through `trackEvent` →
`recordLeadEvent`: questionnaire submission, booking, territory review,
portal opens, and the server-verified video milestones. That single choke
point is where notification evaluation belongs. Nothing else had to change to
get full coverage, and a future event type is notifiable the moment it is
recorded.

## Event types

Event names are the existing `PortalEventName` values (`types/analytics.ts`),
not a parallel vocabulary. The product-level names map onto them as follows.

| Product name | Recorded event | Policy |
| --- | --- | --- |
| `PORTAL_OPENED` | `portal_opened` | dashboard only |
| `OVERVIEW_VIDEO_STARTED` | `video_started` | dashboard only |
| `OVERVIEW_VIDEO_25_PERCENT` | `video_progress_25` | dashboard only |
| `OVERVIEW_VIDEO_50_PERCENT` | `video_progress_50` | dashboard only |
| `OVERVIEW_VIDEO_75_PERCENT` | `video_progress_75` | dashboard only |
| `OVERVIEW_VIDEO_COMPLETED` | `video_completion_threshold_reached` | dashboard only; email behind a flag |
| `QUESTIONNAIRE_STARTED` | `client_questionnaire_started` | dashboard only |
| `QUESTIONNAIRE_COMPLETED` | `questionnaire_submitted` | **immediate email** |
| `CONSULTATION_SCHEDULED` | `calendar_booking_completed`, `consultation_booked` | **immediate email** |
| `STRATEGIST_REVIEW_REQUESTED` | `territory_review_requested` | **immediate email** |
| `TERRITORY_CHECKED` | `territory_search_submitted` | dashboard only |

Unlisted events default to dashboard-only. Adding an event type can never
accidentally start sending mail.

### Video completion

The event is always recorded. It emails only when
`NOTIFY_ON_VIDEO_COMPLETED=true`, because finishing a video is weaker intent
than completing qualification and is the setting most likely to cause
fatigue. `videoCompletedRule()` in `rules.ts` is also the seam for a future
composite rule such as *video completed **and** questionnaire completed* —
that predicate lands in `rules.ts` without touching any page or route.

## Duplicate protection

Every send first claims a `dedupe_key` in `notification_deliveries`, which
carries a unique index. The insert is the gate: if the key is taken, the
dispatcher returns before calling the provider. A retried request, a
double-submit, or two racing instances therefore produce one email.

The key is `leadId:dedupeGroup:channel[:scope]`:

- **`dedupeGroup`** collapses different events that describe one real-world
  action. A booking recorded by the portal (`calendar_booking_completed`) and
  the same booking arriving from the calendar webhook (`consultation_booked`)
  share the `consultation_scheduled` group, so an advisor is told once.
- **`scope`** distinguishes genuinely new occurrences. Questionnaire
  completion is scoped by `QUESTIONNAIRE_VERSION`, so re-answering a revised
  questionnaire is a new notification rather than a suppressed duplicate.

The questionnaire route independently refuses second submissions, so this is
defence in depth rather than the only guard.

## Recipients

`lib/notifications/recipients.ts`, in order:

1. The investor's assigned advisor (`leads.assigned_advisor_id` →
   `staff_users`), when that advisor is still `active` and has an email.
2. `DEFAULT_ADVISOR_NOTIFICATION_EMAIL`.

If neither resolves, a `failed` delivery row is written with the reason and
nothing is sent. No address is ever taken from request input — an investor
cannot influence who is notified.

## Delivery records

`notification_deliveries` (migration `0013`) holds one row per attempt:
`event_type`, `channel`, `template_key`, `recipient`, `status`
(`pending` | `sent` | `failed`), `provider`, `provider_message_id`,
`error_message`, `dedupe_key`, `sent_at`, plus links to the lead, the
organization, and the originating `activity_events` row.

Failures are rows, not just log lines, so "did Darko get told?" is a query:

```sql
select created_at, event_type, recipient, status, error_message
from notification_deliveries
where status <> 'sent'
order by created_at desc;
```

One exception: when `RESEND_API_KEY` / `NOTIFICATION_FROM_EMAIL` are unset,
the dispatcher logs a warning and writes **no** row. Nothing was attempted,
and — more importantly — no dedupe key is burned, so configuring the provider
later does not leave those investors permanently un-notifiable.

## Email provider

Resend, called over its REST API with `fetch`, matching how every other
outbound provider in this codebase is integrated (PostHog, GoHighLevel) and
avoiding a dependency for a single POST. Sends are bounded by an 8-second
timeout.

Provider code is confined to `lib/notifications/email/resend.ts` behind the
`EmailProvider` interface in `provider.ts`. Business logic never imports it.
Swapping providers means adding a sibling file and changing
`getEmailProvider()`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | to send | Resend API key. Server-only. |
| `NOTIFICATION_FROM_EMAIL` | to send | Verified sender, e.g. `GenDev Compass <compass@notifications.example.com>`. |
| `DEFAULT_ADVISOR_NOTIFICATION_EMAIL` | recommended | Fallback recipient when no active advisor is assigned. |
| `NOTIFY_ON_VIDEO_COMPLETED` | no | `true` to email on video completion. Default off. |
| `NEXT_PUBLIC_APP_URL` | recommended | Base URL for the "View Investor" link. A localhost value suppresses the button rather than emailing a dead link. |

With the first two unset the portal runs normally, records all activity, and
sends nothing — the intended state for local development and CI.

## Extending

**Add a new event type.** Add it to `PortalEventName` in
`types/analytics.ts` and record it with `trackEvent(lead, "name", data)`. It
is dashboard-only automatically.

**Turn an event into an email.** Add an entry to `IMMEDIATE` in
`lib/notifications/rules.ts` with a `templateKey` and a `dedupeGroup`, then
add the matching case and builder in
`lib/notifications/templates/index.ts`. Nothing else changes.

**Add a channel.** `notification_deliveries.channel` is text and
`NotificationChannel` is a union — SMS or Slack needs a new provider module
and a channel value, no migration.

### Deliberately not built yet

Slack, SMS, daily digests, a notification-preferences UI, per-advisor
routing rules, and GHL/Kanso notification integration. The pieces those need
are in place: policy is centralized rather than scattered, `channel` is not
an enum, and delivery history is queryable per lead and per status.
