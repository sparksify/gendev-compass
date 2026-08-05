# Territory Advisor

A conversational, preliminary territory-screening tool inside the GenDev
Compass client portal. A prospective franchise buyer types a city, ZIP code,
or market ("Dallas, Texas", "75214", "Within 10 miles of Frisco") and gets a
clear, conversational answer about whether that market *appears* to be open
for the brand they're evaluating — plus a schematic map, a factual market
snapshot, nearby alternatives, and a one-click path to a human review.

**It is a screening tool only.** It never represents that a territory is
legally reserved, officially awarded, or guaranteed to be available; every
result carries a disclaimer, and the "success" path is always a handoff to
the GenDev team.

## Product purpose

1. Answer, preliminarily: *Is this brand currently able to sell franchises
   in my state? Does my area appear open? Are parts of it already
   committed? What nearby markets might still work? What area was actually
   evaluated?*
2. Increase engagement and move qualified prospects toward a conversation
   with the GenDev team (the **Request Territory Review** flow).
3. Capture prospect geographic interest for sales follow-up
   (`territory_searches` + the Search Activity admin tab).

## Architecture

```
Portal (chat UI, SVG map)                    Admin (/advisor/territories)
app/p/[token]/territory-advisor/page.tsx     app/advisor/(app)/territories/*
components/territory/*                       components/advisor/territories/*
        │                                            │
        ▼                                            ▼
app/api/portal/[token]/territory-advisor/*   app/api/advisor/territories/*
   (magic-link token auth, rate-limited)        (staff session + ADMIN role)
        │                                            │
        └──────────────┬─────────────────────────────┘
                       ▼
        lib/territory/evaluate.ts   ← single source of truth for status
        lib/territory/intent.ts     ← deterministic follow-up parsing (no LLM)
        lib/territory/messages.ts   ← client-facing copy per status
        lib/territory/webhook.ts    ← territory.review_requested dispatch
        lib/geocoding/*             ← provider abstraction (local provider today)
                       │
                       ▼
        lib/store (PortalStore: Supabase or file-backed dev store)
        supabase/migrations/0005_territory_advisor.sql
```

Key properties:

- **Deterministic evaluation.** Availability status, overlap, state
  eligibility, and alternatives come exclusively from
  `evaluateTerritory()` + the database. No LLM is involved anywhere in this
  feature; the "conversational" layer is deterministic parsing
  (`lib/territory/intent.ts`) plus templated copy (`lib/territory/messages.ts`).
  If an AI layer is added later it may only rephrase — never decide.
- **Dual-mode store.** Works with zero external services locally (file-backed
  dev store) and with Supabase in production, like the rest of the app.
- **Sanitized client payloads.** The browser receives only
  `TerritoryEvaluationResult` (types/territory.ts) — never territory row IDs,
  internal notes, exact private boundaries, or franchisee identity.

## Territory status logic

`evaluateTerritory({brandId, query, radiusMiles, leadId})` runs, in order:

1. **Brand check** — unknown/inactive brand → `BRAND_NOT_CONFIGURED`.
2. **Geocode** — 0 candidates → `LOCATION_NOT_FOUND`; >1 candidates →
   `LOCATION_NOT_FOUND` with a `candidates` list for the prospect to pick from.
3. **State eligibility** (`brand_state_eligibility`):
   - no row for the state → **`MANUAL_REVIEW`** (an unconfigured state is
     never treated as available)
   - `restricted` / `not_registered` → `STATE_RESTRICTED`
   - `pending` / `manual_review` → `MANUAL_REVIEW`
   - `approved` / `exempt` → continue
4. **Evaluated ZIP set** — the searched ZIP plus all reference ZIPs within
   the radius (5/10/15/25 mi, labeled "Preliminary evaluation area").
5. **Conflict check** against non-archived territories with status
   `sold | reserved | corporate | unavailable | pending`:
   - `zip_list` territories: intersection with the evaluated ZIP set
   - `radius` territories: circle-overlap approximation
   - `reserved` with an expired `reserved_until` → ignored (available again)
   - `county` / `polygon` / `manual` definitions → flag for manual review
     (accepted by the schema, not evaluable yet)
6. **Status decision**:
   - no conflicts → `AVAILABLE` (or `MANUAL_REVIEW` if step 5 flagged one)
   - the exact searched ZIP/point conflicts, or overlap ≥ 75% → `UNAVAILABLE`
   - otherwise → `PARTIALLY_AVAILABLE`
7. **Alternatives** (UNAVAILABLE / PARTIALLY_AVAILABLE only): up to 3 nearby
   cities beyond the searched radius, excluding conflicting ZIPs and
   non-eligible states, ranked by distance. No invented "opportunity scores" —
   only factual market data, shown separately from availability.
8. **Persist** a `territory_searches` row (failure to log never breaks the
   prospect flow).

## State eligibility logic

Per brand, per state (`brand_state_eligibility`, unique on
`brand_id + state_code`): `approved | pending | not_registered | exempt |
restricted | manual_review`. There are 14 commonly-cited franchise
registration states (listed for reference in `lib/geocoding/states.ts`),
but the app never hard-codes an assumption about them — eligibility is
always whatever staff configured for that brand, and **a state with no row
defaults to MANUAL_REVIEW**, never available.

Manage it at **/advisor/territories/eligibility** (ADMIN only): per-state
dropdowns, bulk save, filters, and an explicit "Unconfigured" marker.

## Database schema

`supabase/migrations/0005_territory_advisor.sql` — all tables RLS-enabled
with no policies (service-role only), matching the app's deny-all model:

| Table | Purpose |
|---|---|
| `franchise_brands` | First DB-backed brand entity (the CMDT config in `lib/config/opportunity.ts` maps to it by slug). Seeded with `cmdt`. |
| `brand_state_eligibility` | Per-brand, per-state sales eligibility. |
| `territory_definitions` | Territory records: `zip_list`/`radius` fully supported; `county`/`polygon`/`manual` accepted for later. `public_display_level`: `hidden`/`generalized`/`exact`. |
| `territory_zip_codes` | ZIPs belonging to a `zip_list` territory (unique per territory). |
| `zip_code_reference` | Geocoding source for the built-in provider: city, state, lat/lng, optional demographics. |
| `territory_searches` | One row per evaluated prospect search (sales follow-up + analytics). |
| `territory_review_requests` | The manual-review queue (`new → in_review → contacted → approved/declined → closed`). |
| `zip_code_geographies` | PostGIS boundary layer (`0008_zip_geographies.sql`): ZCTA polygons + centroids for future exact-boundary evaluation. Not yet read by the app. |

## Nationwide ZIP data pipeline

`npm run import:zips` loads the full US ZIP reference (~41k rows: city,
state, county, lat/lng) from the GeoNames postal dataset (CC BY 4.0) into
`zip_code_reference`. Add `-- --dry` to parse and report without writing.
Re-running it never wipes demographics: the GeoNames rows omit the
demographic columns entirely, so upserts leave them untouched.

### Real Census demographics (Market Analysis)

`POST /api/admin/import-demographics` ("Load Census Demographics" on
`/admin` under Territory ZIP Data — **run "Load Nationwide ZIP Data" first**;
this route reads the already-loaded ZIP reference rather than re-downloading
GeoNames) merges those rows with the U.S. Census Bureau's public ACS 5-Year
API (`lib/geocoding/censusImport.ts`): population (B01003), households
(B11001), median household income (B19013), plus a 5-year growth percentage
computed across two vintages (2014–2018 vs 2019–2023 windows; migration
0010 adds `population_growth_pct`, `demographics_source`,
`demographics_vintage`). Each Census fetch times out at 35s (well under the
route's 60s `maxDuration`) so a slow response surfaces as a proper JSON
error instead of Vercel's platform-level HTML timeout page; an optional
`CENSUS_API_KEY` env var (free, instant signup at
api.census.gov/data/key_signup.html) avoids the anonymous per-IP rate limit.
Only ZIPs that actually matched Census data are written, concurrently in
batches. The evaluator aggregates
these across every evaluated ZIP (`aggregateMarketData`) — population and
households sum, income is household-weighted, growth population-weighted —
and the prospect UI (Market Analysis, Territory Assessment, Why this
market?) only ever renders figures that actually loaded, with the source
cited. Nothing is fabricated; missing data is simply omitted.

### Boundary polygons and the interactive maps

`POST /api/admin/import-polygons` (one state per call; buttons on `/admin`
under Territory ZIP Data) loads Census 2010 ZCTA boundary shapes from the
OpenDataDE GeoJSON mirror into `zip_code_geographies.geojson`, simplified to
display weight in the serverless function (`lib/geo/simplify.ts`,
Douglas–Peucker ~200 m tolerance). Two maps consume them (Leaflet over
CARTO/OSM tiles, no API key):

- **Prospect** (Territory Advisor page): real basemap with the searched
  point, evaluation radius, and public ZIP boundaries of the prospect's own
  search area — never any territory status, ownership, or sold boundary.
- **Advisor** (`/advisor/territories/map`): the full picture — every
  territory rendered from its ZIP shapes or radius, color-coded by status,
  with click-through details. Staff session required.

**Hard rule:** all downloading and parsing happens in the script process —
the database only receives small batched upserts through the normal store
layer. Never run HTTP fetches or GeoJSON parsing inside Postgres: the first
import attempt did exactly that against production and froze the database
(out-of-memory) until it was force-restarted. Polygon/boundary loading into
`zip_code_geographies` must follow the same pattern (process the OpenDataDE
state GeoJSON files client-side, then write batched rows).

`leads` is the canonical prospect identity (there is no separate portal
"user" table), so prospect-scoped tables FK to `leads.id`.

## Map and geocoding provider setup

- **Geocoding**: `lib/geocoding/` defines `GeocodingProvider`
  (`geocode`, `reverseGeocode`, `findNearbyZipCodes`). The default `local`
  provider is backed by `zip_code_reference` — no API key. To add Mapbox or
  Google later, implement the interface and add a case in
  `lib/geocoding/index.ts`; nothing else imports provider SDKs.
- **Map**: `components/territory/TerritoryMap.tsx` is a dependency-free
  schematic SVG (pin + translucent evaluation circle + generalized overlap),
  deliberately not a tile-based GIS map. It renders only sanitized data and
  always carries the label "Preliminary evaluation area — not a final
  territory boundary." Swapping in a real map provider later is a
  drop-in replacement of this one component.

## How to add a brand

1. Insert a `franchise_brands` row (slug, name, default radius) — via SQL,
   `store.createBrand()`, or a seed script.
2. Configure its state eligibility at `/advisor/territories/eligibility`.
   Until you do, every search for that brand returns MANUAL_REVIEW.
3. Add its territory records (below).
4. Portal-side, the active brand is resolved in `lib/territory/brand.ts`
   from the current opportunity's slug — when multi-opportunity routing
   ships, that resolver is the only place that needs to learn about it.

## How to configure state eligibility

`/advisor/territories/eligibility` → pick the brand → set each state's
status → **Save**. Unconfigured states are labeled and filterable. Statuses
`approved`/`exempt` allow territory evaluation; everything else stops it
with the appropriate client-facing message.

## How to upload territory ZIP codes

Two ways (both on `/advisor/territories/records`):

1. **Inline**: expand a `zip_list` territory row and paste ZIPs
   (comma/space-separated).
2. **CSV import** — template columns:

```csv
brand_identifier,territory_name,territory_code,status,zip_code,public_display_level,internal_notes
cmdt,Dallas Uptown Territory,DAL-01,sold,75201,generalized,
cmdt,Dallas Uptown Territory,DAL-01,sold,75204,generalized,
```

- `brand_identifier` is the brand **slug**.
- One row per ZIP; rows sharing a `territory_code` (or name) are grouped
  into one territory, which is created if it doesn't exist.
- Every row is validated first (5-digit ZIP, known status/display level,
  known brand); errors are reported **per row** and valid rows still import.

## How to create a radius-based territory

`/advisor/territories/records` → **New Territory** → definition type
`radius` → set center latitude/longitude and radius in miles → status +
public display level → create. The evaluator treats any circle overlap with
a search as a conflict (full containment of the searched point = exact
conflict → UNAVAILABLE).

## How manual review requests work

1. Prospect clicks **Request Territory Review** (or Detailed/Manual Review,
   depending on the result) → confirmation modal (user/brand/market
   pre-filled) → optional message → submit.
2. `POST /api/portal/[token]/territory-advisor/review-request` creates a
   `territory_review_requests` row (status `new`). A client-supplied search
   ID is only linked if it belongs to the requesting lead.
3. The optional webhook fires (below). **Webhook failure never fails the
   request** — the row is already saved.
4. Staff work the queue at `/advisor/territories/reviews`: assign, change
   status, add internal notes, jump to the prospect's full profile
   (questionnaire, search history) via the linked client page.

## Webhook payload

`POST $TERRITORY_REVIEW_WEBHOOK_URL`, fired on review-request creation.
Point it at a GoHighLevel inbound-webhook workflow trigger (or any
receiver) — this is the CRM integration hook; no new CRM was built.

```json
{
  "event": "territory.review_requested",
  "userId": "<lead id>",
  "brandId": "<franchise_brands id>",
  "territorySearchId": "<territory_searches id or null>",
  "reviewRequestId": "<territory_review_requests id>",
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "+15555555555",
  "searchedLocation": "Dallas, TX",
  "resultStatus": "PARTIALLY_AVAILABLE",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

- 8s timeout; failures are logged (`[territory-advisor/review-request]`)
  and surfaced in the result object, never to the prospect.
- If `TERRITORY_REVIEW_WEBHOOK_SECRET` is set, an `x-territory-signature:
  sha256=<hmac-sha256-hex-of-raw-body>` header is included.
- Unset URL outside production → dispatch is simulated (dev/preview parity
  with the FDD workflow's behavior).

## Privacy and security rules

- Every portal endpoint resolves the lead from the magic-link token
  (`requireLead`); every admin endpoint requires a staff session **and**
  the ADMIN role (`requireAdminApi`), with CSRF origin checks on mutations.
  Non-admin staff get a 404 on the admin pages (existence not confirmed).
- Brand/search/territory IDs from the browser are never trusted: searches
  are keyed to the authenticated lead, review-request search links are
  verified against the lead, and the active brand is resolved server-side.
- Rate limits (in-memory, matching existing convention):
  `territory-search:{leadId}` 20/min, `territory-review:{leadId}` 10/min.
- The client payload never includes: internal notes, territory row IDs,
  exact private boundaries or coordinates of awarded territories,
  franchisee/owner identity, webhook credentials, or provider keys.
  Conflicts are reported only as generalized counts/percentages
  (`public_display_level` gates anything more detailed; only
  `hidden`/`generalized` behavior exists today).
- Search terms are length-capped and Zod-validated; SQL access goes through
  the parameterized Supabase client.
- `notes_internal` / `internal_notes` fields are surfaced only in the
  ADMIN UI.

## Known limitations

- **Demographics are not loaded.** `npm run import:zips` provides real
  nationwide names/coordinates, but population/household/income columns are
  null until a real Census/licensed demographics source is added (the demo
  seed's figures were placeholders and are intentionally replaced). The app
  renders gracefully without them.
- The `local` geocoder only resolves what's in the reference table; typo
  tolerance and true neighborhood/POI lookup need a real geocoding provider
  (the abstraction is ready).
- Circle-overlap percentage is an approximation (depth-ratio heuristic, not
  true area intersection) — adequate for screening, not for boundary law.
- `county`/`polygon`/`manual` territory definitions resolve to
  MANUAL_REVIEW rather than being geometrically evaluated.
- Rate limiting is per-instance in-memory (same as the rest of the app).
- No browser-driven e2e test runner exists in the repo; the prospect
  journey is covered by a service-level integration test
  (`tests/territoryEvaluate.test.ts`).
- Follow-up parsing is deterministic; genuinely free-form conversation
  falls back to treating the message as a location query.

## Future expansion options

The schema and service layer were shaped so these can be added without
rebuilding: polygon/county/DMA territories (definition types already
accepted), electronic reservations (`reserved_until` already drives
expiry), franchisee-facing territory views (`public_display_level=exact`),
demographic reports (data lives in `zip_code_reference`), drive-time
polygons and competitor overlays (map component swap), a validated
opportunity-scoring model (Market Snapshot is already structured data), and
brand-specific rules (hang them off `franchise_brands`).
