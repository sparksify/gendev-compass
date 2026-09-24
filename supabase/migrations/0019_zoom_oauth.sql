-- Encrypted, server-only OAuth credentials for the account-managed Zoom app.
-- No anon/authenticated policies: only the server-side service role may read
-- or update this table.
create table if not exists public.zoom_oauth_credentials (
  id text primary key default 'primary',
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  access_token_expires_at timestamptz not null,
  scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zoom_oauth_credentials_singleton_check check (id = 'primary')
);

alter table public.zoom_oauth_credentials enable row level security;
revoke all on table public.zoom_oauth_credentials from anon, authenticated;
grant all on table public.zoom_oauth_credentials to service_role;
