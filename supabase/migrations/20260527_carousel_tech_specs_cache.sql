alter table public.carousel_items
add column if not exists tech_specs jsonb null;

create index if not exists idx_carousel_items_tech_specs_present
on public.carousel_items ((tech_specs is not null));
