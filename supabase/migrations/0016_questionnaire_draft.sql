-- In-progress questionnaire answers (autosave). Written by the portal's
-- draft endpoint as the prospect fills out the form; cleared on final
-- submit once the validated payload lands in questionnaire_responses.
-- Drafts stay in Supabase and are never dispatched to third-party
-- analytics/advertising platforms.
alter table public.leads
  add column if not exists questionnaire_draft jsonb,
  add column if not exists questionnaire_draft_saved_at timestamptz;
