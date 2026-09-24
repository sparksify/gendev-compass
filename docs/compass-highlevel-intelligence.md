# Compass Intelligence V1

Production activation completed on September 24, 2026. The database migration is applied, the sync is enabled, deployment `dpl_3x5cuZV7fg7QdsrdedhTw5HHzpmf` is live, and Leslie Ceazer's selected activity-rich Compass record completed a manual backfill with no retry or error. The HighLevel contact now shows the Compass summary and answer fields, a bridge note, a namespaced tag, and one assigned follow-up task.

## Live observations

- Location: Complete Mobile Drug Testing, `4dwsLmHGWb6ElyIQlZOc`.
- Darko Vasic's user ID: `jVf10AiOgjbh9AzMmB58`, verified in My Staff. The inspected completed-questionnaire contact is already owned by Darko.
- `Compass Intelligence` and `Compass Answers` are separate native, collapsible contact folders. Eight short summary fields occupy the first; one multiline full short-assessment field occupies the second.
- Existing `contact.cq_upload`: `g0OyTj0N4KjwrkbHYE4n`, File Upload, PDF-only, in Contact. It was preserved.
- The latest completed questionnaire inspected in Compass belonged to Randy Law. Searching the configured HighLevel location for the exact email returned one contact, `jEXDCVEK8ATooGS7dl1a`. Its CQ Upload field was empty. **The existing PDF did not pass the live availability/open check.** No prospect data was manually entered or copied during this inspection.
- GenDev Compass private integration exists (`6a72957608a3278e62af82d2`). Its prior credential was revoked by the August 26 token rotation; the failing request was `GET /contacts/?locationId=…&query=…&limit=1` and Compass displayed `GoHighLevel responded 401.` After the production token was replaced and redeployed, runtime contact, note, task, tag, field, user, and write calls succeeded. No token or secret value was logged or copied into documentation.

The non-secret IDs are recorded in `compass-highlevel-live.json`. Runtime resolves fields by key, not these IDs.

## Exact native fields

All keys below begin with `contact.`. Single line maps to API `TEXT`; Multi line maps to `LARGE_TEXT`. Text is used for combined status/time and explicit UTC timestamps so no timezone-dependent date-only field discards the time.

| Folder | Field label | Key suffix | Type |
|---|---|---|---|
| Compass Intelligence | Compass Engagement Status | compass_engagement_status | Single line |
| Compass Intelligence | Compass Why This Lead Matters | compass_why_this_lead_matters | Multi line |
| Compass Intelligence | Compass Next Action | compass_next_action | Single line |
| Compass Intelligence | Compass Bridge Fit Assessment | compass_bridge_fit_assessment | Single line |
| Compass Intelligence | Compass Overview Video | compass_overview_video | Single line |
| Compass Intelligence | Compass Investor Questionnaire | compass_investor_questionnaire | Multi line |
| Compass Intelligence | Compass Qualification Summary | compass_qualification_summary | Multi line |
| Compass Intelligence | Compass Last Meaningful Activity | compass_last_meaningful_activity | Single line |
| Compass Answers | Compass Bridge Answers | compass_bridge_answers | Multi line |

The summary includes separate bridge fit and investor qualification results, plus human-readable timeline and liquid capital. It does not contain the full financial questionnaire.

`Compass Bridge Answers` contains the latest short assessment's original wording, display labels, optional notes, version and submission timestamp from `bridge_assessment_submitted`. A clearly titled native bridge note provides a larger reading surface. Prior submissions remain in the existing Compass event history.

The long questionnaire gets titled native notes containing **every** immutable snapshot question and display answer, including conditional/not-asked values. Long content splits at answer boundaries into numbered parts. Notes are reconciled by stable markers and updated, not appended again on retries. Prospect HTML is escaped. The PDF now renders the immutable snapshot rather than current catalog wording.

## Behavior and tasks

| Evidence | Engagement status | Task / next action |
|---|---|---|
| No meaningful activity | New | None |
| Identified first open or unique video watch | Engaged | None; video alone never creates an urgent task |
| Successfully persisted short assessment | Fit Assessment Complete | One `Follow up — Bridge fit assessment complete` task, due within 24 hours |
| Short assessment plus >=30% unique watch on an allowed overview media | High Intent | Upgrade the same task to `CALL NOW — Bridge assessment + overview engagement`, due now |
| Canonical investor questionnaire and complete versioned answer archive | Questionnaire Complete | Create/upgrade to `REVIEW / CALL — Investor questionnaire complete`, due now |
| Current scheduled/rescheduled booking | Keep achieved status | `Appointment booked`; suppress new call tasks and complete only the integration's existing task |

A cancelled booking allows follow-up again. Completed advisor tasks remain completed on replay; a genuinely higher milestone can reopen the same task. Unknown-time booking records suppress calls conservatively. No HighLevel opportunity/pipeline API is called. Existing advisor notification rules and Darko's questionnaire CC remain in place; this integration sends no additional email alerts.

Owner policy: `GHL_COMPASS_OWNER_POLICY=contact-owner` uses the existing contact owner, falling back to `GHL_COMPASS_DARKO_USER_ID`. `darko` always uses that configured ID. The worker validates membership in the configured HighLevel location and fails visibly rather than assigning an unowned task.

Namespaced tags defined in code and applied through the dedicated add-tags API:

- `Compass: Fit Assessment Complete`
- `Compass: High Intent`
- `Compass: Questionnaire Complete`

Unrelated tags and custom fields are preserved.

## Signal quality

Wistia documents `secondsWatched` as unique seconds, excluding seeks, and `percentWatched` as the unique fraction. Both bridge and portal clients now send unique watch percentage, floor seconds rather than rounding a threshold upward, and stop heartbeats while paused. Bridge end-seeks no longer emit a completion signal unless unique viewing reaches 95%.

The CRM uses new `video_progress.verified_watch` evidence only: `floor(seconds / duration * 10000) / 100`, finite positive duration, finite nonnegative seconds within the media length. Only the configured bridge/investor overview IDs are accepted. Evidence stays separate per media; the highest observed fraction within a media is retained, never summed across sessions or different videos. A database merge prevents stale concurrent writes from reducing evidence. These are first-party player reports, not tamper-proof server-attested viewing. Legacy playhead/wall-clock rows are labelled unverified and cannot trigger High Intent.

No per-contact visit count is produced. `bridge_opened` is a first identified open, and aggregate anonymous bridge visits are not attributed retrospectively.

## Durability, privacy and retries

`compass_intelligence_sync` is an operational outbox, not an analytics database. It contains a lead reference, event key, revision/acknowledged revision, attempt/retry counters, next attempt, last error, lease/fencing token and external contact/note/task/PDF identifiers. Answers stay in `portal_events`, `questionnaire_responses`, and the versioned submission/answer tables.

Database triggers enqueue source changes in the same transaction. Assessment answer writes are required and have deterministic event keys; failures return a retryable save error. Anonymous intake sends a random request ID and hashes it with validated answers, allowing replay to recover the same lead and portal token without using an email-only identity join. Old anonymous clients without the new request ID retain the legacy intake behavior; deploy the updated client and server together.

The questionnaire snapshot/answer insert is transactional and keyed by lead/version. Retries cannot erase the archive. The route stores it before the canonical questionnaire, checks retry answers against it, and does not call a CRM copy complete when the snapshot is missing. An existing historical partial questionnaire without a full archive requires explicit source-record reconciliation; the worker reports the error rather than inventing original wording.

Workers claim one lead at a time using `FOR UPDATE SKIP LOCKED` and a ten-minute lease. Every external create is checkpointed; acknowledgments target the claimed revision, leaving newer events queued. Transient failures back off from one minute to a capped interval. Scheduled retry runs every five minutes through the existing cron-secret authorization. Disabled sync leaves work queued.

HighLevel does not document idempotency keys for note/task creation. A lost POST response is reconciled against stable markers before another action. If the outcome stays ambiguous and no matching item appears, the worker stops creating and records an actionable reconciliation error. It **does not blindly retry a create and risk duplicates**. A definitive HTTP 4xx rejection (except timeout) clears the pending-create marker and may retry. Duplicate remote markers, changed mapped contacts, wrong-location IDs and duplicate email matches fail closed.

Contact resolution prefers the organization-scoped mapping and verifies its location. Without a mapping it uses exact email filtering within the location, retrieves enough results to detect duplicates, and requires one exact result. It never selects the first fuzzy hit or silently upserts a different contact based on account deduplication preferences.

PDF uploads use `<custom_field_id>_<stable_file_id>` and a submission-specific filename. A retry first looks for that file on the correct contact; after an upload it re-reads the field. A missing CQ Upload field can be provisioned as PDF File Upload; an incompatible existing field is not converted/deleted. The summary says `pending / retrying` on failure, while complete native notes remain readable. A successful API attachment check is still separate from the human open/read check.

RLS and grants restrict the outbox and its RPCs to the service role. Cron requires the existing production secret. Financial answers are never passed to tracking, Meta, GTM, PostHog or AI Employee OS; only the authorized HighLevel contact/notes/PDF receive them.

## Before / after example

Illustrative prospect, not data written to a live contact:

**Before:** ordinary contact details/tags, generic video fields, and an empty CQ Upload; Darko must infer whether a bridge assessment was completed.

**After, assessment plus 36% unique watch:**

```text
Compass Intelligence
  Engagement Status: High Intent
  Why This Lead Matters: Bridge fit assessment completed; 36% unique overview
                         watch confirmed at 2026-09-24T16:30:00.000Z.
  Next Action: Call now
  Bridge Fit Assessment: Complete — 2026-09-24T16:28:00.000Z
  Overview Video: 36% unique watch (72 seconds; bridge overview)
  Investor Questionnaire: Not submitted
  Qualification Summary: Bridge fit: Strong (capital + timeline rule)
                         Investor qualification: Pending
                         Timeline: Within 3 months
                         Liquid capital: $250,000–$499,999
  Last Meaningful Activity: 2026-09-24T16:30:00.000Z

Compass Answers [expand]
  Compass Bridge Answers: version, submitted time, every original question,
                          labelled answer, location and optional notes

Task: CALL NOW — Bridge assessment + overview engagement
      Assigned by owner policy; due now; references answers on this contact.
```

After the longer questionnaire: status becomes Questionnaire Complete; its submitted time and full-note/PDF locations are shown; the same task becomes a review/call task unless booked. Bridge answers remain separate.

## Production activation record

1. `20260924164118_compass_intelligence.sql` was applied successfully to production.
2. `GHL_COMPASS_OWNER_POLICY=contact-owner`, the verified Darko fallback ID, and `GHL_COMPASS_ENABLED=true` were set for production; the existing secret values were left unchanged.
3. The tested release was deployed and aliased to `www.gendevcompass.com`.
4. Compass lead `af5042d0-f56b-4b82-870e-59f1eb03b010` was explicitly queued. Revision 1 reached synced revision 1 with retry count 0 and `last_error` null. It resolved HighLevel contact `7eUZOUC42XBFF852Nysf` in the configured location and created one task and one bridge note.

For an ambiguous create, inspect that contact for the exact marker. If found, leave it in place and retry; the worker adopts its ID. Only after confirming the prior request did not create anything should an operator clear that specific `external.pendingCreates` entry. Do not clear all external state or delete unrelated tasks/notes.

## Verification

- Full Vitest suite: 297 tests passed across 31 files (including assessment-only/high-intent/questionnaire/booked/retry/matching/replay cases).
- Production Next.js build passed; TypeScript passed.
- Temporary PostgreSQL migration harness passed: migration applies twice, source enqueue is atomic, duplicate events do not increment work, claims are exclusive, stale watch updates cannot regress, submissions replay without losing answers, anon/authenticated roles cannot access the outbox/RPCs.
- Native HighLevel folder creation, field keys/types, runtime writes, bridge note, tag, and Leslie follow-up task were verified in the browser. Leslie has no completed long investor questionnaire, so no CQ Upload PDF is expected for this backfill; a future completed-questionnaire contact remains the live PDF-open test case.

References: [Wistia unique watch properties](https://docs.wistia.com/docs/player-attributes-and-properties), [HighLevel file-upload format](https://marketplace.gohighlevel.com/docs/ghl/forms/upload-to-custom-fields/), [HighLevel task API](https://marketplace.gohighlevel.com/docs/ghl/contacts/create-task/).
