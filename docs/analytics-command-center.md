# Analytics Command Center

## Architecture audit

### Already Exists

- Multi-brand domain records (`franchise_brands`, opportunities, lead `brand_id`)
- Leads with first/latest-touch UTM and click-ID attribution
- Facebook campaign, ad-set, ad, form, page, and lead identifiers
- Canonical `portal_events` plus append-only activity history
- Wistia start, quartile, completion-threshold, and progress records
- Bridge assessments, questionnaires, qualification results, and review status
- Calendar views, appointments, advisor routing, overflow attribution, and consultation statuses
- GTM, Meta browser Pixel, Meta CAPI, encrypted credentials, consent, diagnostics, and retry queue
- GoHighLevel synchronization and Zoom registration records
- Authenticated admin navigation, scoped lead access, and existing lead-detail activity timeline

### Partially Exists

- Anonymous bridge visits are counted, but not yet linked to a durable anonymous visitor identity
- Landing-page identity is stored as the first landing URL; explicit page/funnel registries do not exist
- Closed/won can be inferred from `CLOSED_INVESTED`, but revenue is not canonical
- Show/no-show exists on appointment records when providers send it

### Missing Before This Build

- Unified analytics route, filter model, cohort/event-date modes, KPI/funnel/trend views
- Local Meta Insights cache and scheduled reconciliation
- Meta Ads reporting connection controls
- Campaign/ad/page downstream quality tables and deterministic funnel-watch reporting

### Needs Refactoring Later

- Replace free-form funnel/page/segment values with an admin-managed registry
- Attach anonymous lander sessions to leads after conversion without exposing PII
- Add canonical close value/revenue fields before showing ROAS
- Move pilot-scale application aggregation into indexed SQL/RPC queries when volume requires it

## Reporting contract

- Meta is authoritative for spend, impressions, reach, clicks, and Meta-reported leads.
- Compass is authoritative for unique prospects and downstream outcomes.
- Lead cohort view reports eventual outcomes for leads acquired in the range.
- Event date view reports milestones that occurred in the range.
- Costs remain blank until Meta reporting is connected; unavailable revenue/ROAS is never fabricated.
- The Meta cache stores one idempotent row per brand/date/ad-account/ad. Campaign and ad-set views aggregate that fact table.
