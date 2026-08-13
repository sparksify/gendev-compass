-- Questionnaire v1.1: physical mailing address, self-reported credit range,
-- and funding qualification (build spec: Expand Candidate Intake
-- Questionnaire With Address, Credit & Funding Qualification).
--
-- All columns are nullable so pre-v1.1 responses remain valid; the UI
-- renders "Not Provided" for missing values. Nothing is dropped or renamed.
--
-- Values are self-reported. estimated_credit_score_range is NOT verified
-- credit information and no credit inquiry is performed or authorized.

alter table public.questionnaire_responses
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists country text,
  add column if not exists estimated_credit_score_range text,
  add column if not exists anticipated_funding_sources jsonb,
  add column if not exists financing_need text,
  add column if not exists preferred_financing_percentage text,
  add column if not exists available_cash_contribution text,
  add column if not exists lender_status text,
  add column if not exists funding_assistance_requested text,
  add column if not exists funding_followup_requested boolean not null default false,
  add column if not exists existing_business_entity text,
  add column if not exists prior_business_financing_experience text;

-- Advisors will filter on candidates who asked for funding help.
create index if not exists questionnaire_responses_funding_followup_idx
  on public.questionnaire_responses (lead_id)
  where funding_followup_requested;

-- Geographic qualification / territory lookups by state + postal code.
create index if not exists questionnaire_responses_state_postal_idx
  on public.questionnaire_responses (state, postal_code);
