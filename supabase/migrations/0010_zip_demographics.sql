-- 0010_zip_demographics.sql
-- Adds provenance and growth columns for real Census ACS demographics on
-- zip_code_reference. Structure only — the data itself is loaded by the
-- admin-triggered serverless import (never inside Postgres; see
-- docs/territory-advisor.md, "Nationwide ZIP data pipeline").
-- Additive and rerunnable.

alter table public.zip_code_reference
  add column if not exists population_growth_pct double precision,
  add column if not exists demographics_source text,
  add column if not exists demographics_vintage text;
