# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Operational rules — deployment workflow, post-Figma-export cleanup, and the **locked carousel-image CSS** — live in AGENTS.md and are authoritative. Read them before any deploy or visual change.

@AGENTS.md

## Commands

```bash
npm run dev      # Next.js dev server (HMR)
npm run build    # production build
npm run start    # serve the production build
npm run lint     # ESLint (flat config: eslint.config.mjs)
npm run verify   # lint + build — the quality gate; mirrors CI (.github/workflows/ci-quality.yml)
npm run backup:bundle  # full git bundle — Windows/PowerShell only
```

- **No test framework is configured** — there are no unit/e2e tests, so there is no "run a single test". Verification = `npm run verify` (lint + build) plus a manual check in the browser. CI (push/PR to `dev`/`master`/`main`) runs lint + build only.
- **Do not run `npm run build` or delete `.next/` while `npm run dev` is running** — it wipes the dev server's manifests and breaks it. Stop the dev server first (see `.cursor/rules/dev_server_safety.md`).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 (via `@tailwindcss/postcss`) · Supabase (`@supabase/supabase-js`) · GSAP + Swiper (animation/carousel) · Zod (validation). The site is Hebrew and RTL (`<html lang="he" dir="rtl">` in `src/app/layout.tsx`); Google fonts are loaded there as CSS variables.

## Two surfaces

1. **Landing page** — `src/app/page.tsx` (server component) plus `src/app/MobileLayer.tsx` (the `<768px` overlay). The hero is a full-viewport `next/image` with separate desktop and mobile sources. Almost all of this page's styling is an inline `<style>` block inside `page.tsx`, **not** in `globals.css`.
2. **Carousel / catalog** — the route is **`/carousel`** (`src/app/carousel/page.tsx` → `CarouselPageClient.tsx`), built on Swiper. Components live in `src/components/carousel/` (`CarouselGrid`, `CategoryNav`, `ProductModal`, `TechSpecsModal`, `ShatterTransition`, `HomeToCarouselCta`). Note the naming mismatch: CSS classes are `catalog-card-*` even though the route is `/carousel`. Carousel/catalog styling lives in `src/app/globals.css` (~2100 lines).

## Feature flag

`NEXT_PUBLIC_ENABLE_CAROUSEL` (`src/lib/carousel/feature-flag.ts`) is the carousel kill-switch. Default = enabled; setting it to `"false"` hides the catalog CTA and redirects `/carousel` → `/`.

## Data layer (Supabase)

- `src/lib/carousel/repository.ts` is the single read/write boundary:
  - `getCarouselPayload()` reads with the **public anon** client.
  - `saveCarouselPayload()` does a full diff-based upsert/delete with the **service-role** client and tolerates older DB schemas (retries the item upsert without `catalog_number`/`source_url` if those columns are missing).
- Tables: `carousel_items`, `carousel_item_angles`, `carousel_settings` (singleton row `id=1`). Schema + storage policies are in `supabase/migrations/`. Per-product spec data is cached as JSON in `carousel_items.tech_specs`.
- **Graceful degradation:** when Supabase env vars are absent, reads return `fallbackCarouselPayload` (`src/lib/carousel/fallback-data.ts`), so the app builds and runs locally with no DB or secrets.

### Environment variables (all optional for a local build — missing ones trigger fallback)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public reads.
- `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PANEL_TOKEN` — required for admin writes and imports.
- `CRON_SECRET` — Vercel cron auth for the tech-specs warmer.

Env access is centralized in `src/lib/supabase/env.ts` (`hasSupabasePublicEnv()` / `hasSupabaseAdminEnv()`); clients are constructed in `src/lib/supabase/server.ts`.

## Admin & catalog import

- `/admin` (`src/app/admin/page.tsx`) is client-token-gated: the token is stored in `localStorage["toptik_admin_token"]` and sent as the `x-admin-token` header. It supports editing items and single/batch (25) import by catalog number.
- Import (`POST /api/admin/import/mandarina`): scrape Mandarina Duck by catalog number (`src/lib/catalog-source/`, `MandarinaDuckScraperProvider`) → download images → re-upload to the Supabase storage bucket **`carousel-media`** → translate the description to Hebrew (Google Translate endpoint) → prefetch & cache tech specs. It returns a **draft** item; the admin must "save all" (`saveCarouselPayload`) to persist it.

## Image pipeline

- `/api/img-trim?u=<supabase-public-url>` (`src/app/api/img-trim/route.ts`) trims the flat product background with `sharp` (threshold 25) and returns immutable-cached WebP. It is SSRF-guarded: only `*.supabase.co` public-storage URLs are allowed, and on any failure it passes the original image through. Wrap product URLs with `trimmedProductSrc()` (`src/lib/carousel/trim-src.ts`); local paths bypass the trimmer.
- `next/image` is configured for AVIF/WebP and the `*.supabase.co` remote pattern in `next.config.ts`.

## Tech-specs cache warmer

`/api/admin/warm-tech-specs` (add `?force=1` to refresh all) scrapes and caches product specs into `carousel_items.tech_specs`. A Vercel cron runs it daily at 03:00 UTC (`vercel.json`). Auth: `x-admin-token` / `?token=`, or `Authorization: Bearer $CRON_SECRET`.
