# GenDev Compass — Investor Qualification Portal

A private investor qualification portal presented as a guided "Investment
Journey" — a three-column client-portal experience (fixed header, sticky
navigation, command-center status card, six-milestone journey timeline,
advisor sidebar, resource library) in the style of premium financial
software. Leads (initially from
Facebook Lead Ads) receive a personalized magic link, watch an investor
overview video, complete a qualification questionnaire, and go straight to
the advisor's calendar to book a consultation.

Scheduling opens the moment the questionnaire is submitted — the advisor
reviews the investor profile before the call, so there is no manual
approval gate between submission and the calendar.

**Primary metric:** qualified booked calls per 100 portal visitors.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript (strict) + Tailwind CSS
- shadcn-style component system (Radix primitives, CVA variants, Lucide icons, Inter)
- React Hook Form + Zod (same schema validates client- and server-side)
- [Supabase](https://supabase.com) Postgres (with a zero-config local dev fallback)
- [Wistia](https://wistia.com) `<wistia-player>` web component for the overview video
- Any iframe-compatible calendar (Calendly, HighLevel, Cal.com, …)
- Event tracking in Supabase (`portal_events`), optional PostHog mirror
- Deployed on [Vercel](https://vercel.com)

## The flow

```
Facebook Lead Form → POST /api/leads → personalized link /p/<token>
  → Dashboard → Investor Overview (Wistia, optional educational path)
  → Qualification Questionnaire
  → /p/<token>/schedule  (calendar embed + FDD request + next-steps timeline)
      → booked → confirmation state on the same page
```

Every prospect who submits the questionnaire can schedule immediately —
the advisor reviews the responses before the call, so there is no manual
approval gate. Server-side qualification still runs at submission and the
score/result are stored on the lead for the advisor's preparation.

Progress persists: reopening the link resumes at the furthest legitimate step.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in what you have; everything has a dev fallback
npm run seed                 # creates the demo lead and prints its portal URL
npm run dev
```

Open the printed demo portal URL. **No Supabase, Wistia, or calendar
credentials are required to test the flow locally**:

- Without Supabase, data is stored in `.dev-data/store.json` (gitignored).
- Without a Wistia media ID, the overview page shows a placeholder and the
  development-only **Simulate video completion** button lets you continue.
- Without a calendar URL, the schedule page shows a placeholder and the
  "I Scheduled My Consultation" fallback button records the booking.

Reset the demo lead's progress at any time:

```bash
npm run seed:reset
```

Development tools (simulate/reset buttons and the dev API route) render
outside production and on Vercel preview deployments; the API independently
refuses on the production deployment.

Run the automated tests (no Supabase or network dependency):

```bash
npm test
```

To exercise the Facebook lead activation flow locally, set
`HIGHLEVEL_INBOUND_WEBHOOK_SECRET` in `.env.local` (the one credential in
this app with no dev fallback — see
[Environment variables](#environment-variables)), then:

```bash
curl -X POST http://localhost:3000/api/integrations/highlevel/facebook-lead \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HIGHLEVEL_INBOUND_WEBHOOK_SECRET" \
  -d '{
    "contactId": "test-contact-1",
    "locationId": "test-location",
    "firstName": "Test",
    "lastName": "Lead",
    "email": "test@example.com",
    "phone": "+12145551212",
    "brandSlug": "cmdt",
    "source": "facebook_lead_ad"
  }'
```

Then open `http://localhost:3000/activate?brand=cmdt` within ~2 minutes —
it should redirect straight into a private portal.

## Supabase setup

1. Create a Supabase project.
2. Apply the migration in `supabase/migrations/0001_initial_schema.sql`:
   - with the CLI: `supabase link --project-ref <ref> && supabase db push`
   - or paste the file into the Supabase SQL editor.
3. Set in `.env.local` (and in Vercel for production):
   - `SUPABASE_URL` — the project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, never exposed to the browser
   - `SUPABASE_ANON_KEY` — reserved for future client features (unused today)

All tables have row-level security enabled with no policies (deny-all); only
the server's service-role client can read or write.

## Wistia configuration

1. Upload the investor overview video to Wistia.
2. Copy the media's hashed ID (the token in the media URL).
3. Set `NEXT_PUBLIC_WISTIA_MEDIA_ID` (and `WISTIA_MEDIA_ID`).

The player is embedded with Wistia's current method — the `<wistia-player>`
web component loaded from `fast.wistia.com/player.js` plus the per-media
module. The client listens to `play` / `pause` / `ended` and reports
`currentTime`, `duration`, and Wistia's unique `secondsWatched` /
`percentWatched` every 10 seconds of playback. The **server** decides
completion; rewinding never lowers saved progress, and an instant drag to the
end is rejected because accumulated watch time is also required.

### Changing the completion threshold

Set `VIDEO_COMPLETION_THRESHOLD` (percent, default `85`). Scoring weights and
the liquid-capital minimum live in `lib/config/qualification.ts`.

## Calendar configuration

Set `NEXT_PUBLIC_CALENDAR_EMBED_URL` to any iframe-compatible scheduling URL
(Calendly event link, HighLevel calendar, Cal.com link, …). Lead name, email,
phone, and lead ID are passed as query parameters so prospects don't re-enter
them (Calendly-style prefill params; harmless for other providers).

Booking detection: the embed listens for Calendly's
`calendly.event_scheduled` and Cal.com's `bookingSuccessful` postMessage
events. A manual **"I Scheduled My Consultation"** button remains as the
temporary fallback for providers without embed events; replace it with a
provider webhook when one is connected.

## FDD request workflow

After the questionnaire is complete, the scheduling page and sidebar offer the prospect
the **Franchise Disclosure Document**. The flow (spec: FDD Request workflow):

1. The prospect confirms their contact information and consents to electronic
   delivery, then clicks **Request the FDD** (`POST /api/portal/[token]/fdd`).
   The request is idempotent — duplicate clicks or replays never trigger a
   second document send (idempotency key `fdd_request:{lead_id}`).
2. The server dispatches to GoHighLevel (`lib/fdd/ghl.ts`) — preferred: the
   contacts API upserts the contact with the `FDD_REQUESTED` tag and enrolls
   it directly in the FDD workflow (`GHL_API_TOKEN` + `GHL_LOCATION_ID` +
   `GHL_FDD_WORKFLOW_ID`, the latter two with single-brand defaults);
   alternative: an inbound workflow webhook (`GHL_FDD_WEBHOOK_URL`).
   Credentials stay server-side; the browser never talks to GoHighLevel.
   With neither configured outside production, dispatch is simulated so the
   whole flow runs locally.
3. Provider callbacks land on `POST /api/webhooks/fdd` (`fdd_sent`,
   `fdd_delivered`, `fdd_received`) and `POST /api/webhooks/fdd/received`
   (acknowledgment only). Webhooks are HMAC-signed (`x-fdd-signature`,
   SHA-256 hex over the raw body with `FDD_WEBHOOK_SECRET`), replay-safe
   (external event IDs are recorded), and out-of-order-safe (the controlled
   `fdd_status` field only moves forward).
4. Acknowledgment starts the configurable waiting period
   (`FDD_WAITING_PERIOD_DAYS`, default 14) and computes the
   franchise-agreement eligibility date shown to the prospect. Timestamps are
   stored in UTC and displayed in `NEXT_PUBLIC_BRAND_TIMEZONE`. The stored
   timestamps and audit log are the record — the countdown is presentation
   only, and the legal start event should be confirmed with franchise counsel.

Every transition is written to the immutable `fdd_audit_log` table (actor,
source, external event ID, IP, before/after values, errors). The **FDD
Requests** section of `/admin` shows each prospect's status and full
timeline, allows a manual resend of failed/stuck requests, and exports the
audit history as JSON. Dev tools include a **Simulate FDD acknowledgment**
button to exercise the waiting-period flow locally.

## Environment variables

See [.env.example](.env.example) for the full annotated list. Key rules:

- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_API_KEY`,
  `ADMIN_TEST_PASSWORD`, `POSTHOG_KEY`, `HIGHLEVEL_INBOUND_WEBHOOK_SECRET`)
  are server-only — never `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_APP_URL` is used to build portal links returned by the API.
- In production, `INTERNAL_API_KEY` and/or `ADMIN_TEST_PASSWORD` **must** be
  set — without them every `POST /api/leads` request is rejected. (Only in
  local development with neither configured is the endpoint open.)
- `HIGHLEVEL_INBOUND_WEBHOOK_SECRET` **must** be set in every environment,
  including local development — unlike `/api/leads`, the HighLevel webhook
  has no open dev fallback since it's reachable from the public internet.
  See [Facebook lead → private portal activation](#facebook-lead--private-portal-activation).

## Creating a test lead

**Option A — internal testing page:** visit `/admin/create-lead`, enter the
`ADMIN_TEST_PASSWORD`, fill in the prospect details, and copy the generated
portal link.

**Option B — API:**

```bash
curl -X POST https://your-domain.com/api/leads \
  -H "Content-Type: application/json" \
  -H "x-api-key: $INTERNAL_API_KEY" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@example.com",
    "phone": "+15555555555",
    "source": "facebook-lead-ad",
    "campaign": "campaign-name"
  }'
# → { "success": true, "leadId": "…", "portalUrl": "https://…/p/<token>" }
```

The endpoint is rate-limited (20/min/IP) and validated with Zod.

## How qualification works

Qualification runs **server-side only** when the questionnaire is submitted
(`lib/portal/qualification.ts`), and is never trusted from the client.

The landing page offers two equal paths: the educational journey (investor
overview video) or a fast track straight to qualification for experienced
investors. The video is no longer a qualification requirement — completing
it still contributes to the informational score.

The only requirement for the calendar is a completed questionnaire —
qualification no longer gates scheduling. The evaluation still runs and
records `qualified` / `review_required` plus a score (0–100+) on the lead
(weights in `lib/config/qualification.ts`, threshold via
`QUALIFICATION_SCORE_THRESHOLD`, default 60) so the advisor can prepare and
the business can add explicit review rules later if specific answers
warrant one — as a targeted rule, not a blanket gate.

## Event tracking

Funnel events (`lead_created`, `portal_opened`, `video_started`,
`video_progress_25/50/75`, `video_completion_threshold_reached`,
`questionnaire_opened`, `questionnaire_submitted`, `lead_qualified`,
`lead_sent_to_review`, `calendar_opened`, `calendar_booking_completed`,
`portal_completed`, …) are written server-side to `portal_events`. Client-
originated events are stored with a `client_` prefix and cannot spoof funnel
events. If `POSTHOG_KEY` is set, events are mirrored to PostHog with a hashed
token as the distinct ID; analytics failures never affect the prospect flow,
and detailed financial answers never leave Supabase.

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Set the production environment variables (see `.env.example`), including
   `NEXT_PUBLIC_APP_URL=https://your-domain.com`.
3. Deploy, connect the custom domain (HTTPS is automatic).
4. Smoke test: create a lead via `/admin/create-lead`, walk the full flow.

Production **requires** Supabase configuration — the file-backed dev store
refuses to run in production, and dev tools/simulation are disabled there.

## Known MVP limitations

- Booking detection relies on embed postMessage events plus a manual
  confirmation fallback — no provider webhook yet, so appointment date/time
  is only captured when the provider's embed event supplies it.
- Rate limiting is in-memory (per serverless instance); move to
  Upstash/Redis for multi-region scale.
- "Questionnaire started" is approximated (client event on first field
  interaction; timestamp finalized at submission).
- Watch-time anti-abuse is deliberately pragmatic (accumulated-time check),
  not fraud-proof — per spec, practical qualification over anti-cheating.
- One brand (CMDT), one advisor, one video today. The activation flow below
  adds a lightweight brand *registry* (`lib/config/brands.ts`) and
  brand/HighLevel columns on `leads` so a second brand can be onboarded
  without a schema change — but the portal UI itself, `lib/config/brand.ts`,
  and `lib/config/opportunity.ts` are still single-brand; wiring a second
  brand's portal presentation is a separate piece of work.
- No automated emails/SMS — prospects only see in-portal state.

## Facebook lead → private portal activation

A person completes a Facebook Instant Lead Form; HighLevel forwards it to
Compass immediately; clicking **"Create My Private Portal"** on Facebook's
completion screen opens `/activate?brand=cmdt`, which authenticates the
browser and redirects into the private portal within seconds — no email
re-entry, SMS code, or password.

```
Facebook Instant Form → HighLevel → POST /api/integrations/highlevel/facebook-lead
  (unclaimed external_leads row)

Facebook completion screen "Create My Private Portal"
  → /activate?brand=cmdt[&form=&campaign=&ad=&page=&source=]
  → POST /api/portal-activation/start   (opaque activation id in an HTTP-only cookie)
  → GET  /api/portal-activation/status  (polled every ~1.5s)
      → one unclaimed lead matches → atomic claim → portal user provisioned
        → redirect to /p/<portal_token>
      → zero or multiple plausible leads → last-four phone fallback
        → POST /api/portal-activation/phone-last-four
```

**This is a deliberate MVP tradeoff, not strong authentication.** Matching
is time-window + attribution-context correlation, with last-four phone
digits as the disambiguation fallback — the shared Facebook completion URL
carries no unique lead identifier. The flow **never guesses** between
multiple plausible leads: ambiguity always routes to the last-four
fallback, never to "pick the newest one." See `lib/portalActivation/matching.ts`
for the tiering/ambiguity rules and `HIGHLEVEL_SETUP.md` for the HighLevel
workflow configuration.

**⚠️ Residual risk to flag explicitly:** the portal this flow grants access
to *does* collect sensitive investor-supplied financial data once inside
(`questionnaire_responses`: liquid capital, net worth, business ownership —
see "How qualification works" below). A successful match under this
lightweight scheme grants entry to that portal. This is accepted as
reasonable for a franchise-opportunity MVP (not a banking/medical/credit
system, per spec) but is worth re-evaluating before scaling volume or if
the questionnaire ever collects more sensitive data than it does today.

### Data model

Reuses the existing `leads` table as the portal user + opportunity record
(one row already represents one person's brand engagement) rather than
introducing parallel account/opportunity tables. Adds:

- `leads.brand_slug`, `highlevel_contact_id`, `highlevel_location_id`,
  `advisor_id` — brand/HighLevel identity on the existing record.
- `external_leads` — Facebook/HighLevel intake staging, unclaimed until
  matched. Idempotent on `(highlevel_contact_id, highlevel_location_id, brand_slug)`.
- `portal_activations` — one row per browser's activation attempt,
  correlated by an opaque id in an HTTP-only cookie (`pa_id`) — never in
  the URL, never an email/phone/contact id.

See `supabase/migrations/0004_portal_activation.sql` for the full schema,
indexes, and the partial unique index that backs the atomic claim
(`claimed_by_activation_id` unique where not null).

### Matching & atomic claiming

`lib/portalActivation/matching.ts` is pure, store-agnostic logic (unit
tested in isolation): unclaimed + right brand + inside the arrival window,
then cascading tiers from most to least specific — **form + campaign/ad/page
context → form only → brand + source + time**. A tier that resolves to
exactly one candidate matches; a tier with more than one is ambiguous and
the flow does **not** fall through to a broader tier (broader tiers only
add candidates, never resolve ambiguity) — it goes to the last-four
fallback instead.

Claiming is a single conditional `UPDATE … WHERE claimed_at IS NULL`
(`lib/store/*Store.ts` → `claimExternalLead`) — atomic at the row level, so
two activations racing for the same lead can never both win; the loser
retries the match live rather than reusing the already-claimed record.

### Configuration

```
HIGHLEVEL_INBOUND_WEBHOOK_SECRET=      # required — see HIGHLEVEL_SETUP.md
PORTAL_AUTO_MATCH_BEFORE_SECONDS=120   # lead may have arrived up to this long before activation
PORTAL_AUTO_MATCH_AFTER_SECONDS=30     # or up to this long after
PORTAL_ACTIVATION_MAX_WAIT_SECONDS=30  # how long the browser polls before the fallback is offered
PORTAL_ACTIVATION_POLL_INTERVAL_MS=1500
PORTAL_ACTIVATION_TTL_MINUTES=15
PORTAL_LAST_FOUR_MAX_ATTEMPTS=5
PORTAL_TIME_MATCHING_ENABLED=true      # set "false" to force last-four fallback for every activation
```

### Diagnostics

`/admin` → **Facebook Lead Activation** shows automatic-match success rate
and recent activations (brand, status, matching tier, candidate count,
failure reason — never phone/email/HighLevel ids). The same data is
available at `GET /api/admin/portal-activation` (admin-password gated).
Structured, PII-free events (`lead_received`, `activation_started`,
`activation_matched`, `activation_ambiguous`, `activation_fallback_required`,
`activation_expired`, …) are also written to the server log via
`lib/portalActivation/log.ts`.

### Testing

```bash
npm test          # lib/portalActivation/*.test.ts + app/api/**/route.test.ts
npm run test:watch
```

Tests use an in-memory fake store (`lib/portalActivation/fakeStore.ts`, via
`vi.mock("@/lib/store")`) — no Supabase or filesystem dependency. Coverage
includes: pure-tier matching and ambiguity detection, one unique lead
auto-matched, delayed/early lead arrival, two simultaneous leads, two
simultaneous activations racing an atomic claim, last-four resolving a
unique lead vs. staying ambiguous vs. exceeding max attempts, duplicate
HighLevel webhook idempotency, activation reuse on refresh, existing portal
user reuse, an existing user gaining access to a new brand without a
duplicate account, expired activation, invalid brand, and unauthorized
webhook calls.

## Next recommended integrations

1. **Calendar provider webhook** for authoritative booking capture
   (appointment ID, start time, reschedules, cancellations).
2. **CRM sync** (HighLevel/CloseBot) on `lead_qualified` / `booked`.
3. **Email/SMS nudges** for stalled prospects (video started, not finished).
4. **PostHog dashboards** for the funnel metrics listed in the spec.
5. **Second brand onboarding**: add an entry to `lib/config/brands.ts` and
   extend `lib/config/opportunity.ts`/`lib/config/brand.ts` for
   per-brand presentation — the activation flow's data model already
   supports it.

## Project structure

```
app/
  activate/                Facebook completion-screen destination (activation UI)
  admin/create-lead/       internal testing page (password-gated)
  admin/                   asset uploads, FDD dashboard, activation diagnostics
  api/leads/               lead creation (API-key/admin-password gated)
  api/portal-activation/   start, status (polled), phone-last-four
  api/integrations/highlevel/facebook-lead/   inbound HighLevel webhook
  api/admin/portal-activation/   activation diagnostics API
  api/portal/[token]/      portal state, opened, video-progress,
                           questionnaire, booking, dev (dev-only)
  api/events/              client event sink (prefixed, whitelisted)
  p/[token]/               journey dashboard, overview, questionnaire, schedule, complete
components/
  ui/                      design-system primitives (button, card, badge, accordion, …)
  layout/                  TopNavigation, SidebarNavigation, RightSidebar, PortalShell
  dashboard/               StatusCard, ProgressTimeline, VideoCard, Checklist, FAQ, …
  cards/                   AdvisorCard, ProgressSummaryCard, DocumentCard, ComingSoonCard
  forms/                   QuestionnaireForm (React Hook Form + Zod)
  portal/                  WistiaPlayer, CalendarEmbed, dev tools, ActivationScreen, shared portal pieces
lib/
  config/                  brand, brands (registry), qualification, portalActivation, env helpers
  portal/                  state machine, qualification, progress, events, tokens
  portalActivation/        matching engine, service, normalize, cookies, log, fakeStore (tests)
  store/                   data layer: Supabase + local dev store
  supabase/                service-role client (server-only)
  validation/              Zod schemas
scripts/seed.ts            demo lead seeding / reset
supabase/migrations/       SQL migrations
types/                     shared domain types
HIGHLEVEL_SETUP.md          HighLevel workflow/webhook configuration guide
```
