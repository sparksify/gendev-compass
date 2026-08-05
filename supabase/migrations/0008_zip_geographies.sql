-- ZIP geography layer for the Territory Advisor.
--
-- Reconciles the schema that was introduced out-of-band during the first
-- ZCTA import attempt (2026-08-05) into the migration history, so every
-- environment converges to the same shape:
--
--   * zip_code_reference  — the geocoding lookup the app reads
--     (lib/geocoding/localProvider.ts). Nationwide rows are loaded by
--     scripts/import-zip-data.ts (GeoNames, processed OUTSIDE the
--     database — never via in-database HTTP).
--   * zip_code_geographies — PostGIS boundary layer (ZCTA polygons) for
--     future exact-boundary territory evaluation. Not yet read by the
--     application; polygons are loaded per state by a follow-up pipeline.
--
-- PostGIS-dependent objects are guarded so this migration also applies
-- cleanly on environments without the PostGIS extension (e.g. the local
-- migration test harness); on Supabase, PostGIS is available and the full
-- table is created.
--
-- IMPORTANT: bulk data loading does not belong in migrations. This file
-- only creates structure (plus the small curated zip_code_reference seed
-- for empty environments).

-- ---------------------------------------------------------------------------
-- zip_code_reference — recreate if missing (it was dropped out-of-band and
-- restored from the curated seed; environments that never lost it are
-- unaffected). Identical to the 0005 definition.
-- ---------------------------------------------------------------------------
create table if not exists public.zip_code_reference (
  zip_code text primary key,
  city text not null,
  state_code text not null,
  county_name text,
  latitude numeric not null,
  longitude numeric not null,
  population integer,
  households integer,
  median_household_income integer,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists zip_code_reference_state_idx on public.zip_code_reference (state_code);
create index if not exists zip_code_reference_city_state_idx on public.zip_code_reference (city, state_code);

alter table public.zip_code_reference enable row level security;

-- ---------------------------------------------------------------------------
-- zip_code_geographies — PostGIS boundary layer. Guarded: created only when
-- PostGIS is available (always true on Supabase).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'postgis') then
    create extension if not exists postgis with schema extensions;

    create table if not exists public.zip_code_geographies (
      zip_code text primary key,
      city text,
      state_code text,
      county_name text,
      latitude double precision not null,
      longitude double precision not null,
      geometry extensions.geometry(MultiPolygon, 4326),
      centroid extensions.geometry(Point, 4326) not null,
      geometry_source text,
      geometry_version text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists zip_code_geographies_state_idx
      on public.zip_code_geographies (state_code);
    create index if not exists zip_code_geographies_centroid_idx
      on public.zip_code_geographies using gist (centroid);
    create index if not exists zip_code_geographies_geometry_idx
      on public.zip_code_geographies using gist (geometry);

    alter table public.zip_code_geographies enable row level security;
  else
    raise notice 'PostGIS not available — skipping zip_code_geographies (Supabase environments create it).';
  end if;
end
$$;
