-- Admin password vault. Secrets are AES-256-GCM encrypted in the application
-- (src/lib/admin/vault.ts) before they ever reach the DB; this table only ever
-- holds ciphertext in `secret_encrypted`. RLS is enabled with NO policies, so
-- anon/authenticated clients are denied entirely — only the service-role key
-- (used by the session-gated, email-OTP-stepped-up panel APIs) can read/write.

create extension if not exists "pgcrypto";

create table if not exists public.admin_vault_entries (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  username text not null default '',
  secret_encrypted text not null,
  url text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_vault_entries enable row level security;
-- Intentionally no policies: deny all to anon + authenticated; service-role bypasses RLS.

create index if not exists admin_vault_entries_label_idx
  on public.admin_vault_entries (label);
