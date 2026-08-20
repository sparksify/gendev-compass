-- Links a territory_definitions row back to the original document it was
-- marked from — e.g. a "Territory Demographic Report" PDF exported from
-- the team's mapping software and uploaded via the admin "Upload Territory
-- Report" flow. Purely an audit trail (staff-only; never shown to
-- prospects), so nullable and additive — existing territories created by
-- hand or via CSV import simply have no source document.
alter table territory_definitions
  add column if not exists source_document_url text,
  add column if not exists source_document_filename text,
  add column if not exists source_document_uploaded_at timestamptz;
