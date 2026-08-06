-- Display-grade GeoJSON for ZIP boundaries.
--
-- zip_code_geographies.geojson holds a SIMPLIFIED (display-tolerance)
-- GeoJSON geometry per ZIP, written by the polygon import pipeline
-- (app/api/admin/import-polygons — all download/parse/simplify work happens
-- in the serverless function, never inside Postgres). The PostGIS `geometry`
-- column remains reserved for future exact-boundary evaluation; rendering
-- reads `geojson` directly.
--
-- Guarded: zip_code_geographies only exists where PostGIS does (see 0008).
do $$
begin
  if to_regclass('public.zip_code_geographies') is not null then
    alter table public.zip_code_geographies
      add column if not exists geojson jsonb;
  else
    raise notice 'zip_code_geographies absent (no PostGIS) — skipping geojson column.';
  end if;
end
$$;
