# Tracking & Attribution

Phase 11's tracking and attribution layer for the Investor Portal: Google
Tag Manager, Meta Pixel, Meta Conversions API, UTM/Facebook attribution,
browser/server dedup, consent, diagnostics, and admin configuration.

## Architecture

```
Portal Action
    ↓
trackEvent() (lib/portal/events.ts)
    ↓
portal_events / activity_events (canonical internal event log)
    ↓
dispatchPortalEvent() (lib/tracking/dispatch.ts)
    ↓
 ┌───────────────────────────────┐
 │                               │
 ↓                               ↓
Browser Tracking              Server Tracking
GTM dataLayer                 Meta Conversions API
    ↓                               ↓
Meta Pixel (via GTM, or         Meta
direct mode) / GA4 / future tags
```

**The application owns the truth.** Whether a prospect watched the video,
qualified, or booked lives in the portal database (`leads`, `portal_events`,
`activity_events`). GTM and Meta are downstream copies for attribution and
optimization — the app never depends on them to know portal state.

Every meaningful portal action calls `trackEvent(lead, eventName, ...)`
(`lib/portal/events.ts`). That function is the **only** place a page or API
route should touch tracking — it:

1. Records the event in `portal_events`/`activity_events` (unchanged from
   before this phase).
2. Forwards a copy to PostHog when configured (unchanged).
3. Calls `dispatchPortalEvent()` (`lib/tracking/dispatch.ts`), which:
   - Generates (or reuses) a single `event_id` for browser/server dedup.
   - Decides which providers should receive the event from the coded
     taxonomy (`lib/tracking/taxonomy.ts`) and any admin override
     (`tracking_settings.event_overrides`).
   - Builds the GTM `dataLayer` payload (safe fields only).
   - Fires Meta Conversions API server-side, fire-and-safe (never throws
     back to the caller; failures are queued for bounded retry).
   - Logs one row per provider attempt to `tracking_deliveries` for
     diagnostics.
   - Returns `{ eventId, dataLayerPayload, metaPixelBrowser }` so the
     caller (an API route) can hand it back to the client, which pushes it
     to `dataLayer` and/or fires the Pixel directly with the **same**
     `event_id` Meta CAPI used.

No page component pushes to `dataLayer` or calls `fbq()` directly — they
call `firePortalTrackingResults()` (`lib/tracking/client.ts`) with whatever
`{ eventId, dataLayerPayload, metaPixelBrowser }` the API route returned.

## Do not double-fire Meta Pixel

`meta_browser_mode` is a single enum (`gtm` | `direct` | `server_only`), so
exactly one of these is ever true per deployment:

- **`gtm`** (preferred): the app never initializes the Pixel. It only pushes
  to `dataLayer`; the Meta Pixel tag lives inside the GTM container and
  reads `event_id` from the same payload for dedup against CAPI.
- **`direct`**: `components/tracking/TrackingScripts.tsx` initializes
  `fbq()` directly; GTM (if also enabled) must not also carry a Meta Pixel
  tag, or events double-fire. The admin UI (`/admin/tracking`) warns when
  both GTM and direct mode are enabled simultaneously.
- **`server_only`**: no browser Pixel at all — only Meta CAPI fires.

## GTM dataLayer contract

Every portal event sent to GTM uses the same envelope:

```js
window.dataLayer.push({
  event: "portal_event",
  portal_event_name: "video_completion_threshold_reached",
  event_id: "evt_...",
  lead_id: "...",
  brand: "CMDT",
  source: "facebook",
  campaign: "...",
  // event-specific extras (dataLayerExtras) — never PII/financial data
});
```

GTM trigger configuration is therefore always the same shape:

- **Trigger**: Custom Event → `portal_event`
- **Condition**: `portal_event_name` equals e.g. `appointment_booked`

Never pushed to `dataLayer`: email, phone, liquid capital, net worth, or any
questionnaire free-text answer. `lib/tracking/dispatch.ts` only ever builds
the payload from coarse fields (`source`, `campaign`, `qualification_status`
as a boolean-ish string, etc.) — never from raw questionnaire input.

## Canonical event taxonomy → Meta mapping

`lib/tracking/taxonomy.ts` is the coded default; `/admin/tracking` →
**Event Mapping** lets an admin toggle GTM/Meta Browser/Meta CAPI per event
and override the Meta event name without a deploy
(`tracking_settings.event_overrides`).

| Portal event | Tier | Meta event (default) |
| --- | --- | --- |
| `portal_opened` | 4 | `ViewContent` |
| `video_started` | 4 | `InvestorOverviewStarted` (custom) |
| `video_completion_threshold_reached` | 3 | `InvestorOverviewCompleted` (custom) |
| `questionnaire_started` | 4 | `QualificationStarted` (custom) |
| `questionnaire_submitted` | 3 | `CompleteRegistration` |
| `lead_qualified` | 2 | `Lead` |
| `calendar_opened` | 3 | `ConsultationUnlocked` (custom) |
| `appointment_booked` | 1 | `Schedule` |
| `portal_completed` | 4 | `PortalCompleted` (custom) |

Verify Meta's currently supported standard events and the Conversions API
payload/auth requirements against
[Meta's developer docs](https://developers.facebook.com/docs/marketing-api/conversions-api)
before relying on any of the above in production — standard event names and
API versions change over time. `META_GRAPH_API_VERSION`
(`lib/config/tracking.ts`) is the single place to bump the API version.

**Conversion hierarchy** (do not optimize ad spend on tier 4 volume alone):

1. **Tier 1 — Primary**: `appointment_booked`
2. **Tier 2 — Qualified**: `lead_qualified`
3. **Tier 3 — Qualification progress**: `video_completion_threshold_reached`, `questionnaire_submitted`, `calendar_opened`
4. **Tier 4 — Engagement**: `portal_opened`, `video_started`, `resource_viewed`

`calendar_booking_completed` (the existing internal event) intentionally
does **not** map to Meta — `appointment_booked` is the single canonical
event mapped to `Schedule`, so one booking is never double-counted.

## Attribution

Captured on the prospect's first portal visit and never overwritten
afterward (first-touch): `utm_source/medium/campaign/content/term`,
`fbclid`, `gclid`, `msclkid`, `_fbp`, `_fbc`, `referrer`, `landing_page` —
see `lib/tracking/attribution.ts` and the `leads.first_*` columns
(migration `0012_tracking_attribution.sql`).

Two capture paths:

- **Lead creation** (`app/api/leads/route.ts`): first-touch fields accepted
  directly in the payload (from an ad platform or CRM automation that has
  browser context this server-to-server call doesn't).
- **Portal visit** (`components/tracking/AttributionCapture.tsx` →
  `app/api/portal/[token]/attribution/route.ts`): a client component reads
  the current URL, `document.referrer`, and the `_fbp`/`_fbc` cookies (set
  by the Pixel when it's running) once per page load and posts them. This
  runs client-side specifically because server layouts don't receive
  `searchParams` in Next.js's App Router, and cookies the Pixel sets aren't
  visible to the very first server render anyway.

Latest-touch (`leads.last_*`) updates only on a "qualified" visit — one
that actually carries a UTM param or click ID, not every page view — so an
internal navigation click never overwrites it with nulls. A booked
appointment always retains its original first-touch attribution even after
a later-touch visit (e.g. clicking an email reminder).

### Facebook Lead Ads

`facebook_campaign_id/adset_id/ad_id/form_id/page_id` extend the existing
`facebook_lead_id/source/campaign/ad_set/ad` fields
(`lib/validation/lead.ts`, `app/api/leads/route.ts`). Populated via CRM
automation or the lead creation API today; a direct Facebook Lead Ads
webhook is a future extension point — it would call the same
`store.createLead()` / attribution-field path, no redesign needed.

## Meta CAPI user matching & PII

`lib/tracking/metaHash.ts` normalizes and SHA-256-hashes email/phone/
name/city/state/zip/country before they leave the app; `fbp`/`fbc`/IP/UA
are sent unhashed per Meta's spec (they aren't PII). **Never** sent to Meta
(or GTM/dataLayer): net worth, liquid capital, questionnaire free-text
answers, risk profile. Callers opt in explicitly to what `custom_data`
leaves the portal (`TrackPortalEventOptions.meta.customData` in
`lib/portal/events.ts`) — nothing is derived automatically from generic
event metadata, so a future event can't accidentally leak financial data by
omission.

## Secrets

The Meta CAPI access token is a server secret. It is:

- Never returned in any API response (`/admin/tracking` GET only reports
  `metaCapiAccessTokenConfigured: boolean`).
- Encrypted at rest with AES-256-GCM (`lib/tracking/crypto.ts`) using
  `TRACKING_ENCRYPTION_KEY`. Without that key configured, the admin UI
  cannot save a token at all — only the `META_CAPI_ACCESS_TOKEN` env var
  fallback works, which never touches the database.
- Never logged; provider responses are sanitized
  (`sanitizeProviderResponse` in `lib/tracking/dispatch.ts`) before being
  stored in `tracking_deliveries.provider_response`.

## Server queue & retry

A portal action's own success is never coupled to Meta's availability
(questionnaire submission, booking, etc. all save first — see the route
handlers in `app/api/portal/[token]/`). A failed Meta CAPI delivery is
queued (`tracking_deliveries.status = 'failed'`, `next_attempt_at` set) and
retried with bounded backoff by `app/api/cron/tracking-retry/route.ts`
(scheduled hourly in `vercel.json`; the retry schedule itself is
5m → 30m → 2h, then it stops — see `RETRY_DELAYS_MS` in
`lib/tracking/dispatch.ts`).

## Consent

Placeholder framework only (`lib/tracking/consent.ts`,
`components/tracking/ConsentBanner.tsx`) — categories are Necessary
(always on), Analytics, and Marketing. When `tracking_settings.
consent_required` is on, Meta Pixel / GTM-managed advertising tags do not
load until marketing consent is granted (`TrackingScripts` reads the
consent cookie server-side before rendering). **This is not legal advice**
— the copy and default behavior are placeholders for legal/privacy counsel
to review against the deployment's actual jurisdiction(s).

## Test mode

`/admin/tracking` → Settings has **Test Installation** (GTM), **Test
Installation** (Meta browser), and **Send Test Event** (Meta CAPI, using
the configured Test Event Code so Meta itself excludes it from normal
reporting). All test-event endpoints are rate-limited
(`app/api/admin/tracking/test/route.ts`).

## Data model

- `leads` — attribution columns added by migration `0012` (`first_*` /
  `last_*` / `facebook_*` / `advisor_*` / `overflow_used`).
- `tracking_settings` — one row (brand-scoped column present but unused in
  this single-brand MVP) holding GTM/Meta/consent configuration.
- `tracking_deliveries` — one row per provider attempt, separate from
  `portal_events` so diagnostics don't bloat the primary event table.
- `portal_consent` — append-only consent decision log.

## Extending to a new provider (Google Ads / LinkedIn / TikTok)

1. Add a `provider` value to `types/tracking.ts` (`TrackingProvider`) and
   the `tracking_deliveries_provider_check` constraint.
2. Add its enable/ID fields to `tracking_settings` (a migration) and
   `TrackingSettingsRecord`.
3. Extend `lib/tracking/taxonomy.ts` with the new provider's default
   per-event toggles.
4. Either extend `dispatchPortalEvent()` (server-side APIs like Meta CAPI)
   or add the tag inside GTM and key off the existing `portal_event`
   dataLayer contract (no code change needed for a pure-GTM tag).

No portal page or API route needs to change — this is the point of routing
every action through one internal event system.
