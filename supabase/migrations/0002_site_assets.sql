-- Site assets: admin-uploaded branding and documents.
-- Files live in the public `portal-assets` storage bucket; this table maps
-- a stable slot key (site-logo, brand-logo, …) to the current file.

create table if not exists site_assets (
  key text primary key,
  url text not null,
  filename text,
  content_type text,
  size_bytes bigint,
  updated_at timestamptz not null default now()
);

-- Deny-all RLS: only the server's service-role client reads or writes.
alter table site_assets enable row level security;

-- Public bucket for portal-served assets (logos, documents). Uploads go
-- through the service-role client; reads are public CDN URLs.
insert into storage.buckets (id, name, public)
values ('portal-assets', 'portal-assets', true)
on conflict (id) do nothing;
