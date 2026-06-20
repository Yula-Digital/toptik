-- Per-product colour set scraped from Mandarina Duck (every colour is a
-- separate MD product). Cached as JSON on the item, mirroring tech_specs:
-- written out-of-band by the import route + colour warmer, read in the payload.
alter table public.carousel_items
add column if not exists colors jsonb null;

create index if not exists idx_carousel_items_colors_present
on public.carousel_items ((colors is not null));
