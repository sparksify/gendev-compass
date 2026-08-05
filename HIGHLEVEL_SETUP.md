# HighLevel setup — Facebook lead → private portal activation

This is the GoHighLevel-side configuration for the low-friction activation
flow: a Facebook Instant Form lead flows into HighLevel, HighLevel forwards
it to Compass immediately, and the prospect's "Create My Private Portal"
click on Facebook's completion screen lands them in their authenticated
portal within seconds — no email re-entry, SMS code, or password.

See the main [README](./README.md#facebook-lead--private-portal-activation)
for the architecture and matching rules this setup feeds.

## 1. Workflow trigger

In the GoHighLevel sub-account (location) connected to the Facebook Page:

1. Create (or open) the workflow attached to the **Facebook Lead Form
   Submitted** trigger for the relevant Ad/Page/Form.
2. Add a **Webhook** action as the **first step** in the workflow — no
   delay, no wait step before it. The whole point of this flow is that the
   lead is available to Compass before the prospect finishes reading
   Facebook's completion screen.

## 2. Outbound webhook

- **URL:** `https://YOUR-DOMAIN.com/api/integrations/highlevel/facebook-lead`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer HIGHLEVEL_INBOUND_WEBHOOK_SECRET` — the exact
    value configured in Compass's `HIGHLEVEL_INBOUND_WEBHOOK_SECRET`
    environment variable. Requests without a matching header are rejected
    with `401` and never touch lead data.

### Payload

```json
{
  "contactId": "{{contact.id}}",
  "locationId": "{{location.id}}",
  "firstName": "{{contact.first_name}}",
  "lastName": "{{contact.last_name}}",
  "email": "{{contact.email}}",
  "phone": "{{contact.phone}}",
  "brandSlug": "cmdt",
  "advisorId": "",
  "source": "facebook_lead_ad",
  "facebookPageId": "{{trigger.page_id}}",
  "facebookFormId": "{{trigger.form_id}}",
  "facebookCampaignId": "{{trigger.campaign_id}}",
  "facebookAdId": "{{trigger.ad_id}}",
  "submittedAt": "{{trigger.date_created}}"
}
```

Field notes:

- `contactId` / `locationId` are **required** — they're the idempotency key
  (a retried or duplicate webhook delivery is a no-op, never a duplicate
  lead or duplicate portal user).
- `brandSlug` is **required** and must match a slug Compass recognizes
  (currently `cmdt`). **Map this explicitly per workflow** if the same
  HighLevel location ever serves more than one brand — do not assume the
  default. An unrecognized slug is rejected.
- `facebookFormId`, `facebookCampaignId`, `facebookAdId`, `facebookPageId`
  are optional but **strongly recommended**. They're what let Compass use
  the most specific, most confident matching tier (form + campaign/ad/page
  context) instead of falling back to the loosest brand + arrival-time
  tier. Include whichever of these GoHighLevel's Facebook integration
  exposes on the trigger — only wire up merge fields you've verified are
  actually populated in your account; don't assume one is available.
- `source` defaults to `facebook_lead_ad` if omitted — leave it as-is
  unless you're intentionally distinguishing lead sources.
- `submittedAt` should be the real Facebook submission time if available;
  Compass separately records its own receipt time (`received_at`) either
  way, so an approximate value here is not a correctness problem for
  matching, only for reporting delivery latency.

## 3. Facebook completion-screen button

In the Facebook Lead Ads form builder, under the completion screen:

- **Button label:** `Create My Private Portal`
- **Button URL:** `https://YOUR-DOMAIN.com/activate?brand=cmdt`

Only attach query parameters Facebook can populate reliably and
consistently for every submission of that specific form/campaign — **not**
per-lead merge fields (Facebook's shared completion URL does not carry a
unique lead identifier). In practice that means static, form-level values
you set once when building the button:

```
https://YOUR-DOMAIN.com/activate?brand=cmdt&form=<facebook_form_id>&campaign=<campaign_id>&ad=<ad_id>&page=<page_id>&source=facebook_lead_ad
```

Every one of `form`, `campaign`, `ad`, `page`, `source` is optional — but
whichever ones you can set, set. They only ever narrow the automatic match
to a more specific, more confident tier; they never weaken it.

## 4. Timing

The whole flow depends on the webhook firing **immediately** on submission:

- No delay/wait step before the webhook action.
- No approval or routing step ahead of it in the workflow.
- Compass's matching window defaults to accepting a lead delivered up to
  30 seconds *after* the activation page opens and up to 2 minutes
  *before* it (`PORTAL_AUTO_MATCH_AFTER_SECONDS` /
  `PORTAL_AUTO_MATCH_BEFORE_SECONDS`) — real-world HighLevel→Compass
  latency should stay well inside that, but if delivery is
  consistently slow in your account, widen the after-window rather than
  relying on a slower webhook.

## 5. Sending people their portal link even if they don't click the button

Every inbound lead gets its portal link generated **immediately on
receipt** — not only when someone clicks "Create My Private Portal" on
Facebook. Compass pushes that link into a HighLevel **contact custom
field** so any workflow (email, SMS, a "didn't finish signing up?"
follow-up) can send it directly.

1. In HighLevel: **Settings → Custom Fields → Contact** → add a new field.
   Give it the key `portal_link` (matching `GHL_PORTAL_URL_FIELD_KEY` below
   — if you name it something else, set that env var to match instead).
2. In Compass's environment variables, make sure `GHL_API_TOKEN` is set
   (the same Private Integration token used for the FDD workflow —
   Contacts write scope) and `GHL_PORTAL_URL_FIELD_KEY=portal_link`.
3. That's it — no workflow step needed for this part. The field populates
   automatically the moment the lead webhook (step 2 above) fires.
4. Use it anywhere in HighLevel with the merge tag `{{ contact.portal_link }}`
   — e.g. in a follow-up email/SMS action: *"Pick up where you left off:
   {{ contact.portal_link }}"*.
5. If a lead re-submits or the webhook retries, the same field is simply
   overwritten with the same link — the person's portal never changes, and
   clicking Facebook's button later still lands them in that same portal.

If the sync fails (wrong field key, expired token, etc.), lead intake still
succeeds — check the webhook's JSON response (`portalLinkSynced`,
`portalLinkSyncError`) or the server logs for the reason.

## 6. Testing

1. Set `HIGHLEVEL_INBOUND_WEBHOOK_SECRET` in Compass and in the workflow's
   webhook header.
2. Submit a real (or GoHighLevel's test) Facebook lead through the form.
3. Confirm the workflow's webhook step shows a `200` response
   `{"success": true, "duplicate": false}`.
4. Open `/activate?brand=cmdt` (with matching `form`/`campaign`/`ad`/`page`
   params if configured) within the matching window and confirm it
   redirects into the private portal.
5. Check `/admin` → **Facebook Lead Activation** for the resulting
   activation's status, matching tier, and candidate count.

If matching is unreliable in early testing, set
`PORTAL_TIME_MATCHING_ENABLED=false` to force every activation straight to
the last-four fallback while the webhook timing is investigated — no code
change required.
