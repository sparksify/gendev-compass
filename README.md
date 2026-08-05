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
2. The server dispatches to GoHighLevel (`lib/fdd/ghl.ts`) — via an inbound
   workflow webhook (`GHL_FDD_WEBHOOK_URL`, preferred) or the contacts API
   with the `FDD_REQUESTED` tag (`GHL_API_TOKEN` + `GHL_LOCATION_ID`).
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
  `ADMIN_TEST_PASSWORD`, `POSTHOG_KEY`) are server-only — never `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_APP_URL` is used to build portal links returned by the API.
- In production, `INTERNAL_API_KEY` and/or `ADMIN_TEST_PASSWORD` **must** be
  set — without them every `POST /api/leads` request is rejected. (Only in
  local development with neither configured is the endpoint open.)

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
- One brand, one advisor, one video; extension points exist in
  `lib/config/` but multi-brand routing is out of scope.
- No automated emails/SMS — prospects only see in-portal state.

## Next recommended integrations

1. **Facebook Lead Ads webhook** → `POST /api/leads` (endpoint is ready;
   add signature verification).
2. **Calendar provider webhook** for authoritative booking capture
   (appointment ID, start time, reschedules, cancellations).
3. **CRM sync** (HighLevel/CloseBot) on `lead_qualified` / `booked`.
4. **Email/SMS nudges** for stalled prospects (video started, not finished).
5. **PostHog dashboards** for the funnel metrics listed in the spec.

## Project structure

```
app/
  admin/create-lead/       internal testing page (password-gated)
  api/leads/               lead creation (API-key/admin-password gated)
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
  portal/                  WistiaPlayer, CalendarEmbed, dev tools, shared portal pieces
lib/
  config/                  brand, qualification, env helpers
  portal/                  state machine, qualification, progress, events, tokens
  store/                   data layer: Supabase + local dev store
  supabase/                service-role client (server-only)
  validation/              Zod schemas
scripts/seed.ts            demo lead seeding / reset
supabase/migrations/       SQL migrations
types/                     shared domain types
```
