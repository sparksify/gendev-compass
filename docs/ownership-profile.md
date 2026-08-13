# Ownership Profile

A self-directed, eight-section assessment in which an investor describes what
they want out of business ownership: their motivations, the work they enjoy,
how hands-on they want to be, growth appetite, industries of interest,
priorities, background, and timeline.

**It is not a qualification instrument.** Nothing here is scored and nothing
gates the funnel — qualification lives entirely in the questionnaire
(`lib/portal/qualification.ts`). This exists so an advisor walks into a
consultation already knowing what the investor cares about.

## Storage

Saved to `ownership_profiles` (migration `0014`), one row per lead, upserted
as the investor answers.

### Why progressive, not save-on-finish

Someone who answers six of eight sections and abandons is still worth
reading. Saving only on completion would discard them entirely, and would
also lose anyone who switched devices mid-assessment.
`answered_sections` records how much of the picture is filled in, so a
partial profile can be read with the right amount of confidence.

### Why localStorage is still there

`hooks/useOwnershipProfileStorage.ts` writes to `localStorage` immediately
and to the server on a 1.5-second debounce. The debounce matters: the
ownership-style slider emits a change per pixel of drag, and writing each one
would mean hundreds of requests for a single answer.

The browser copy is the resilience layer — answers survive a dropped
connection, a tab closed before the debounce fires, or a failed request. The
server is the record of truth: it is what the advisor dashboard reads and
what the completion email is built from.

On mount the two are reconciled by `updatedAt`, newest wins. That is what
lets an investor start on a phone and finish on a laptop. It is a
last-write-wins merge, which suits a single-user form and would not suit
concurrent editing.

### Values, not labels

Columns store the option keys from `types/ownershipProfile.ts`
(`long-term-wealth`, `recurring-revenue`, …), never the display text. Wording
can change without a data migration, and the label helpers in that same
module are the single place the two are joined. Multi-select answers are
`text[]` rather than JSON so they stay queryable:

```sql
select count(*) from ownership_profiles where 'recurring-revenue' = any(priorities);
```

## Completion and notification

The **server** decides what counts as a completion. The client sends a
`completed` boolean — never a timestamp — and the route emits
`ownership_profile_completed` only on the transition from unfinished to
finished, checked against the stored `completed_at`.

That makes the advisor email fire exactly once no matter how many autosaves
follow. `completed_at` is also sticky: an investor reopening the summary to
edit does not clear it and cannot trigger a second notification.

See [notifications.md](notifications.md) for the delivery layer.

## Security

- The profile always belongs to the portal token's own lead. The payload has
  no lead field, so one investor cannot write another's profile.
- Only known option values are accepted, and selection limits are enforced
  server-side as well as in the UI — `lib/validation/ownershipProfile.ts` is
  the boundary that actually matters.
- RLS mirrors the other member-readable tables: authenticated reads scoped by
  active organization membership, no browser-facing write policy.

## Where it appears

- **Investor**: `/p/[token]/ownership-profile`
- **Advisor**: the Ownership Profile card on the investor detail page,
  rendered for partial profiles as well as complete ones
- **Email**: on completion, to the assigned advisor or the default inbox

## Not built yet

The original intent (see `types/ownershipProfile.ts`) was to personalize
resources, FAQs, and AI chat from this data. None of that reads the profile
today — it is captured and displayed, nothing more. The data is now durable
and queryable, which is the prerequisite for any of it.
