-- TOPTIK Admin panel — settings storage for the admin.toptik.co.il surface.
--
-- Admin ACCOUNTS live in Supabase Auth (auth.users), capped at 3 in app code.
-- This migration only adds the singleton settings row used by the panel
-- (currently: the WhatsApp AI agent toggle + its configuration).
--
-- Security model: the table is reachable ONLY through the service-role client
-- behind session-gated API routes. RLS is enabled with NO permissive policies,
-- so anon / authenticated roles get nothing; the service role bypasses RLS.

create table if not exists public.admin_settings (
  id integer primary key default 1,
  whatsapp_enabled boolean not null default false,
  whatsapp_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text null,
  constraint admin_settings_singleton check (id = 1)
);

insert into public.admin_settings (id, whatsapp_enabled, whatsapp_config)
values (1, false, '{}'::jsonb)
on conflict (id) do nothing;

alter table public.admin_settings enable row level security;

-- No anon/authenticated policies on purpose: only the service role may touch
-- this row (enforced in src/lib/admin/settings.ts via the service-role client).
drop policy if exists "admin_settings_no_public" on public.admin_settings;
