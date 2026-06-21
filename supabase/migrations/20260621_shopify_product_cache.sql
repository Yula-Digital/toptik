-- Shopify product cache: a flat SKU → variant map, refreshed daily by
-- /api/shopify/sync (and, optionally, by the inbound /api/shopify/webhook).
-- The gallery reads it via /api/shopify/products-cache to wire each product's
-- "buy" button to a direct cart URL. Data is non-sensitive (public cart links),
-- so anon SELECT is allowed; writes go through the service-role key only.

create table if not exists public.shopify_product_cache (
  sku text primary key,
  variant_id text not null,
  cart_url text not null,
  title text not null default '',
  in_stock boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.shopify_product_cache enable row level security;

-- Public read (cart URLs are public); no insert/update/delete policies, so
-- writes are restricted to the service-role key (which bypasses RLS).
drop policy if exists "shopify_product_cache_read" on public.shopify_product_cache;
create policy "shopify_product_cache_read"
  on public.shopify_product_cache
  for select
  to anon, authenticated
  using (true);

create index if not exists shopify_product_cache_updated_at_idx
  on public.shopify_product_cache (updated_at);
