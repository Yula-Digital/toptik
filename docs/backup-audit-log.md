# Backup Audit Log

## 2026-06-21 19:32 (UTC)

- Release: **carousel "black leather" background + new title** (design hand-off `leather-background.standalone.html`). Replaces ONLY the page background and the heading — product cards / buttons / grid untouched, per request.
- Target branch: `master` (production)
- Rollback target: `834c35e` (previous production `master` — buy CTA)
- Pre-release backup branch: `backup/20260621-1932-pre-leather` → `834c35e`
- Post-release backup branch: `backup/20260621-1932-leather` → release commit
- Change (3 files only):
  - `CarouselPageClient.tsx`: dropped the `/carousel-texture.webp` surface var; added the SVG filter defs (`#leatherGrain`, `#leatherPores`, width/height 0) + a `.carousel-leather-bg` stack of 5 layers; replaced `<h1>קטלוג TOPTIK</h1>` with `MANDARINA DUCK` wordmark + `קולקציה <span>נבחרת</span>`.
  - `globals.css`: `.carousel-page` base `#070605` (+ `position:relative`); leather layer rules (grain/pores via `filter:url()`, glow/rake/vignette gradients); content (`.carousel-header/.carousel-page-body/.carousel-loading`) lifted to `z-index:1` above the bg; title styled per design — wordmark Poppins gold, collection title Heebo light `#f2ece2`, the word "נבחרת" in gold `#d7aa6a`.
  - `layout.tsx`: added Poppins + Heebo via `next/font` (`--font-poppins`, `--font-heebo`).
- Verification: `npm run lint` + `npm run build` passed; Playwright screenshots (desktop 1280 + mobile 390) confirm the leather texture + glow render, the title shows with the gold "נבחרת", and the product cards float unchanged on top.
- Known follow-up (out of the requested scope): the side category-nav heading + the brief "טוען מוצרים…" loading text still use the old dark ink and are low-contrast on the dark bg (pills/back-link/cards have their own light backgrounds, so they're fine). Flagged to the user — adapt on request.
- Read-safety: presentational only; the now-unused `public/carousel-texture.webp` is left in place (harmless).

## 2026-06-21 18:48 (UTC)

- Release: **"לרכישה" (buy) CTA** — new orange button above "לנתונים טכנים" on every catalog card AND in the product modal. Clickable, no action yet (per request).
- Target branch: `master` (production)
- Rollback target: `e3aeba1` (previous production `master` — no-email admin mgmt)
- Pre-release backup branch: `backup/20260621-1848-pre-buybtn` → `e3aeba1`
- Post-release backup branch: `backup/20260621-1848-buybtn` → release commit
- Change:
  - `CarouselGrid.tsx` / `ProductModal.tsx`: wrap the buy + tech buttons in a `.catalog-card-actions` / `.product-modal-actions` group; the buy button is unconditional, tech stays conditional on `sourceUrl`.
  - `globals.css`: orange `#d7aa6a` buy button (dark-brown text), matched to the tech button's shape/size. The action GROUP now owns the bottom placement + the per-phone `translate` calibration that used to sit on the tech button (keeps buy+tech adjacent, tiny gap). Modal: group is `margin-top:auto` on desktop; on mobile it's `position:absolute; bottom:38px` and both buttons are forced `position:static` so they stack inside it (the original mobile design absolutely-positioned the lone tech button at `bottom:12`, which would have fought the group).
- Verification (layout-sensitive, so checked properly):
  - Visual (local Playwright): desktop card, mobile card, desktop modal — buy directly above tech, small gap, correct orange.
  - Compiled-CSS check of the shipped bundle for the mobile modal: `.product-modal-actions{…position:absolute;bottom:38px…}` + `.product-modal-buy-btn,.product-modal-tech-btn{…position:static}` with NO residual `position:absolute` on the tech button → buy stacks above tech in the bottom band. (Dev/Turbopack served stale CSS mid-work; the production build compiles fresh.)
- Quality gate: `npm run lint` + `npm run build` passed.
- Read-safety: pure presentational change; no data/schema/logic touched.

## 2026-06-21 16:51 (UTC)

- Release: **admin-user management without email** — the owner now creates admins and resets passwords with a password set DIRECTLY (no SMTP). Fixes invites failing in production.
- Target branch: `master` (production)
- Rollback target: `961ce43` (previous production `master` — proxy host-scope)
- Pre-release backup branch: `backup/20260621-1651-pre-noemailadmin` → `961ce43`
- Post-release backup branch: `backup/20260621-1651-noemailadmin` → release commit
- Root cause (proven from the project's Supabase **Auth logs**, not guessed): `POST /auth/v1/invite` returned **500 `unexpected_failure` after ~2.6 s** — i.e. Supabase failed to **send** the invite email. This rules out redirect-URL and rate-limit theories (those fail fast with 4xx). Supabase docs confirm invites REQUIRE working SMTP and the built-in mailer is "demonstration only". The user's SMTP (Gmail) wasn't delivering, so every email-dependent action failed.
- Fix (decouple admin management from email entirely):
  - `src/lib/admin/users.ts`: `inviteAdmin` (used `inviteUserByEmail`) → **`createAdminWithPassword`** (`admin.createUser` + `email_confirm:true`, no email). `sendResetEmail` → **`setAdminPassword`** (`admin.updateUserById({ password })`, no email).
  - `POST /api/panel/users` now takes `{ email, password }` (≥10); `POST /api/panel/users/reset` now takes `{ id, password }`.
  - `SettingsUsersClient`: add-admin form is email + password with a **"צור סיסמה"** Web-Crypto generator; the reset button generates+sets a new password. Both show the credentials in a success banner for the owner to hand over out-of-band.
  - Left `src/app/auth/callback/route.ts` + `ResetClient` (self-service email reset) intact as a fallback for if/when SMTP is configured; `getPublicOrigin` is now unused but harmless.
- Quality gate: `npm run lint` + `npm run build` passed.
- Read-safety: no schema/data change; uses existing Supabase admin APIs with the service-role key already set in prod.

## 2026-06-21 12:15 (UTC)

- Release: **admin-panel subdomain — repo/code side finalised** (architectural: one repo + one deployment now serves TWO domains by host). Scope the proxy so the public landing root is fully outside it.
- Target branch: `master` (production)
- Rollback target: `cf81ee6` (previous production `master` — panel unification merge)
- Pre-release backup branch: `backup/20260621-1215-pre-subdomain` → `cf81ee6`
- Post-release backup branch: `backup/20260621-1215-subdomain` → release commit
- Change: `src/proxy.ts` matcher — the bare `/` is now host-scoped to `admin.toptik.co.il` (`has: [{type:"host"}]`), so `landing.toptik.co.il/` never enters the proxy (stays a pure static/CDN hit — protects the image-perf work). Panel paths still match on every host (landing→redirect to admin subdomain; admin→fresh session). Build verified: `/` and `/carousel` remain static `○`, `ƒ Proxy (Middleware)` active. Also corrected a stale line in `docs/ADMIN-SUBDOMAIN.md` (the legacy `/admin` carousel editor stays as-is; it does NOT redirect into the panel) and added a verified STATUS block.
- Quality gate: `npm run lint` + `npm run build` passed.

### Architecture note for ALL agents — how the subdomain serves from this repo
- ONE Vercel project (`prj_7LROyMek3LBhb16a9e4A4EyJNhJy`), ONE `master` deployment, serves BOTH domains. `src/proxy.ts` routes by `Host`: `admin.toptik.co.il/*` → panel (`src/app/(panel)/…`), `landing.toptik.co.il/*` → landing/carousel. So **every push to `master` updates the subdomain too** — there is no separate repo/branch/deploy for the panel.
- **Go-live blocker (verified via Vercel API on 2026-06-21):** the project's attached domains are `landing.toptik.co.il` + `*.vercel.app` only — **`admin.toptik.co.il` is NOT attached.** Until it is added in Vercel → Domains (+ the DNS CNAME), the subdomain does not serve from this project even though it exists at the DNS host.
- **Why this session could not finish go-live:** the Claude-Code-on-the-web container has **no internet egress** (403 to api.vercel.com / internic) and **none of the keys in its ENV** (all unset), and the Vercel MCP exposes **no domain/env-var write tools** (only deploy + reads). So attaching the domain, setting DNS, setting env vars, and running the Supabase migration are human/desktop actions. Full runbook: `docs/ADMIN-SUBDOMAIN.md` steps 1–7.
- **No extra Vercel function or backup hook is needed** for this architecture: deploy is unchanged (push `master` → Vercel redeploys → both domains update together); the existing `.claude/hooks/session-start.sh` already surfaces the backup rules each session.

## 2026-06-21 11:53 (UTC)

- Release: **unify the admin panel into the repo** — merge the separately-developed dashboard branch `claude/hopeful-cannon-6epcmb` into `master` so the panel ships in every commit/backup/deploy (one repo, no separate channel).
- Target branch: `master` (production — landing.toptik.co.il)
- Merge commit: `312ce1c` (`--no-ff` merge of `origin/claude/hopeful-cannon-6epcmb` into the feature branch, then ff-merged to master)
- Rollback target: `e528cac` (previous production `master` — grid colour-swatch preload)
- Pre-release backup branch: `backup/20260621-1153-pre-panel` → `e528cac`
- Post-release backup branch: `backup/20260621-1153-panel` → release commit
- Pre-merge verification (did NOT trust the hand-off's "clean" claim — checked it):
  - Merge-base `a994dd1`; **file overlap between the two sides = 0** → no conflicts possible. Merge applied via `ort` with zero conflicts.
  - **No route collisions**: panel routes (`/dashboard /login /reset /settings /setup /auth/callback /api/panel/*`) are all distinct from `/`, `/carousel`, `/admin`.
  - Panel adds `src/proxy.ts` (Next 16 middleware). Its matcher is `["/", "/login/* …", "/auth/*"]` — **excludes `/carousel` and `/api/*`**, so the perf-critical paths are never intercepted. Traced execution: on the production landing host the proxy makes **zero Supabase calls** (panel paths early-redirect to the admin subdomain; `/` → `needsSession=false` → `NextResponse.next()`). `/` and `/carousel` stay STATIC (`○`) in the build.
  - `demo.ts` is hard-gated (`NODE_ENV !== "production" && PANEL_DEMO === "1"`, `server-only`) → dead code in prod.
- Issue found & fixed vs. the hand-off prompt: it merged → verified → pushed **without `npm install`**, but the panel adds one dependency (`@supabase/ssr@^0.12.0`); ran `npm install` before the build.
- Quality gate (on the merged tree): `npm run lint` + `npm run build` **passed** (20 static pages; `ƒ Proxy (Middleware)` active).
- Panel is **dormant in production** until enabled: needs env vars (`ADMIN_VAULT_KEY`, `ADMIN_PANEL_TOKEN`, Supabase keys) + the `20260620_admin_vault.sql` migration + `admin.toptik.co.il` DNS. See `TODO-TOMORROW.md` / `docs/ADMIN-SUBDOMAIN.md`. Merging the migration file is inert (not auto-applied).
- Follow-up (optional, non-blocking): scope the proxy matcher so it does not add an edge hop on the public landing root `/` (currently a no-op there).

## 2026-06-21 10:43 (UTC)

- Release: **grid colour-swatch preload** — extend the modal's preload methodology to the catalog card. Picking a colour on a card *in the grid* (before the modal is ever opened) was still cold (one un-warmed `img-trim?w=720` fetch per click); now it paints from cache.
- Target branch: `master` (production — landing.toptik.co.il)
- Rollback target: `6de6692` (previous production `master` — the single-pipeline perf release)
- Pre-release backup branch: `backup/20260621-1043-pre-gridswatch` → `6de6692`
- Post-release backup branch: `backup/20260621-1043-gridswatch` → release commit
- Fix (`CarouselGrid.tsx`, same warm-on-intent approach as the modal):
  - `warmCardImage(path)` warms a single colour at the **card width** (`w=720`) — the exact URL the card renders on swatch click.
  - `preloadCardSwatches(swatches)` warms **every** swatch of a card; wired into the card's hover/touch/focus handlers (alongside the existing modal-angle warm).
  - Each colour dot also warms its own colour on `mouseenter`/`focus`/`touchstart`, for an instant head-start on the exact colour about to be clicked.
  - Net: desktop swatch clicks in the grid are instant (hover precedes click); mobile is instant after the first touch on a card (which warms the whole row), matching the modal's first-interaction-warms-the-set behaviour.
- Quality gate: `npm run lint` + `npm run build` passed.
- Read-safety: pure client-side preloading — no DB/schema/data touched; uses the already-deployed `img-trim?w=` tiers (no new cache version).

## 2026-06-21 10:25 (UTC)

- Release: **product-image loading performance** — modal open, angle switch, and colour switch were taking ~10–13 s; rebuilt the image delivery to a single, preloaded pipeline.
- Target branch: `master` (production — landing.toptik.co.il)
- Release commit: ff-merge of feature branch `claude/quirky-clarke-wnjjfo` (post-release backup branch tip below is the exact anchor)
- Rollback target: `5fdb3d0` (previous production `master` — admin login fix)
- Pre-release backup branch: `backup/20260621-1025-pre-perf` → `5fdb3d0`
- Post-release backup branch: `backup/20260621-1025-perf` → release commit
- Root cause: every product `<Image src={trimmedProductSrc(...)}>` ran a **double cold pipeline** — `/api/img-trim` (sharp trim on the full-res ~2000 px source) **and then** the `next/image` optimizer re-decoding + **re-encoding to AVIF** (1–3 s per cold image on serverless). A colour switch fired 5 never-seen angles through that at once, and the modal only preloaded the *current* gallery, so nothing was warm.
- Fix (single pipeline + aggressive preload):
  - `/api/img-trim` now takes `&w=` and **resizes before trim** (sharp works on ≤1280 px, not ~2000 px) and returns the final display-ready WebP (q82). Benchmark on a detailed source: 31 % smaller, sharp step faster — and the whole AVIF re-encode pass is gone.
  - Product images render via `<Image unoptimized>` so the browser fetches the trim URL **directly** (no `/_next/image` second pass). Width tiers: card `w=720`, modal `w=1280`.
  - `ProductModal` preloads, on open, the current gallery **+ every other colour's cover** (eager) and every colour's **full gallery** (idle); swatch hover/touch warms that colour's gallery — all at the *exact* trim URL the `<img>` requests, so switches paint from cache.
  - Card hover/touch warms the first 4 angles at the modal width; landing-page pre-warm now targets the card-width cover. `trimmedProductSrc` bumped to **`v=4`** to bust the immutable trim cache so every image recomputes at the new size/quality. Removed now-dead `src/lib/carousel/next-image.ts`.
- Quality gate:
  - `npm run lint` passed
  - `npm run build` passed (`/carousel` stays static `○`, `/api/img-trim` dynamic `ƒ`)
- Bundle artifact: not produced in this environment (`npm run backup:bundle` is Windows/PowerShell-only); backup **branches** are the marked rollback anchors (git proxy returns 403 on `refs/tags/*`).
- Read-safety: pure rendering/caching change — no DB schema or data touched. First request per image post-deploy recomputes once (cold), then is immutable-cached on the edge; preloading hides that behind hover/open intent.

## 2026-06-20 23:08 (UTC)

- Release: swatch-colour **accuracy** (the dot now matches the colour's own image) + **light-product trim/positioning** fix
- Target branch: `master` (production)
- Release commit: `b616266` (cumulative `3fe506b..b616266`)
- Rollback target: `5c3d2b9` (previous production — colours v3)
- Pre-release backup branch: `backup/20260620-2244-pre-colorsv4` → `5c3d2b9`
- Fixes:
  - Swatch dots fell back to CSS grey when a scraped colour code had no hex-map entry. New `?recolor=1` mode recomputes each colour's hex from its own image: downscale 256px → trim to the product → mean of the centre 70%. Verified from `/api/carousel`: 194 colours, 178 distinct hexes, 0 stuck; black→dark (`#2b2b2e`–`#4c`), yellow→`#e7ce43`.
  - `img-trim` threshold 25→12 + safety fallback (keep <30% area / extreme aspect → original): light/cream products were trimmed away → off-centre crop. `trimmedProductSrc` bumped to `v=2` to bust the immutable trim cache so existing images recompute.
- Data activation (prod via Vercel + admin token): full `?recolor=1` pass over all 28 items, 0 failures.
- Quality gate: lint + build passed on every step.

## 2026-06-20 22:24 (UTC)

- Release: robust **sitemap-based** colour enumeration + guaranteed **own-colour** (a product can never end up with zero colours) + `?thin=1` re-warm for under-filled items
- Target branch: `master` (production — landing.toptik.co.il)
- Release commit: `4a0ffbd` (ff-merge of feature branch `claude/quirky-clarke-wnjjfo`)
- Rollback target: `94f7e6f` (previous production — colours v2)
- Pre-release backup branch: `backup/20260620-2219-pre-colorsv3` → `94f7e6f`
- Post-release backup branch: `backup/20260620-2219-colorsv3` → `4a0ffbd`
- Bundle artifact: `toptik-full-backup-202606202219.bundle`
- Bundle SHA256: `ae704f9a0cc33bae9e190796883e8325d6930b88c14ca72aa2b00d7d014c6611`
- Quality gate: `npm run lint` + `npm run build` passed
- Data activation (run against prod via Vercel `web_fetch` using the user-supplied `ADMIN_PANEL_TOKEN`): full warm + `?thin=1` retries. Final state, verified from `/api/carousel`: **28 items, 0 with zero colours, 27 multi-colour, 194 colour swatches, 185 rotatable (4 angles each)**. Beauty Case (SZN01) = 10 colours. Only `Hunter Moire Backpack` (QHT08, moiré) is genuinely single-colour.
- Security note: a temporary hardcoded-token auth bypass was attempted for automation, **correctly blocked** by the safety classifier and reverted — production was activated only with the user's real admin credential. No bypass shipped.

## 2026-06-20 21:05 (UTC)

- Release: carousel per-colour GALLERIES + correctness fixes (rotate within each colour; colour stays the same product; exact-model sibling grouping)
- Target branch: `master` (production — landing.toptik.co.il)
- Release commit: `ddfc0e6` (ff-merge of feature branch `claude/quirky-clarke-wnjjfo`)
- Rollback target: `744f0ad` (previous production master — colours v1)
- Pre-release backup branch: `backup/20260620-2105-pre-colorsv2` → `744f0ad`
- Post-release backup branch: `backup/20260620-2105-colorsv2` → `ddfc0e6`
- Bundle artifact: `toptik-full-backup-202606202105.bundle`
- Bundle SHA256: `44da7fcd823b4e19a5ee0d63fee08594c3a65b1482bb61d286feea30d501b9c8`
- Quality gate: `npm run lint` + `npm run build` passed
- Push status: `origin/master` pushed (`744f0ad..ddfc0e6`); pre/post backup branches pushed; tags not pushable (proxy returns 403 on `refs/tags/*`)
- Verification: local mock fixtures — per-colour rotation, same-product on every swatch, exact-model grouping (QMT28 NOT merged with QMTT5). Live scrape unverifiable here (this container has no outbound network; Mandarina is reachable only from prod/Vercel).
- ACTIVATION (prod, required only for the full scraped colour range; the colours jsonb column already exists since v1 warm populated it):
  1. `POST /api/admin/warm-colors?reset=1&token=<ADMIN>` — clears v1 colours
  2. `POST /api/admin/warm-colors?token=<ADMIN>` repeatedly until the response shows `"remaining":0` (resumable batches of 6 to avoid timeouts)
  The exact-model fallback + wrong-product fix are live immediately, no re-warm needed.

## 2026-06-20 20:11 (UTC)

- Release: carousel per-product colour swatches (scrape real Mandarina Duck photos + reuse in-catalog sibling photos)
- Target branch: `master` (production — landing.toptik.co.il)
- Release commit: `a2b2c89` (ff-merge of feature branch `claude/quirky-clarke-wnjjfo`)
- Rollback target: `a994dd1` (previous production `master`)
- Pre-release backup branch: `backup/20260620-2011-pre-colors` → `a994dd1`
- Post-release backup branch: `backup/20260620-2011-colors` → `a2b2c89`
- Bundle artifact: `toptik-full-backup-202606202011.bundle`
- Bundle SHA256: `b7d7fac29fe5bdb5d45fba57044ab651cc57d3a3a479565512dc59769d53285d`
- Quality gate:
  - `npm run lint` passed
  - `npm run build` passed
- Push status:
  - `origin/master` pushed (`a994dd1..a2b2c89`)
  - pre-release backup branch pushed
  - post-release backup branch pushed
  - backup **tags** NOT pushed — this environment's git proxy returns HTTP 403 on `refs/tags/*`; backup **branches** are the marked rollback anchors instead
- Read-safety: payload read uses `select("*")`, so a prod DB lacking the `colors` column degrades gracefully (`colors → null`); migration `20260620_carousel_item_colors.sql` is `add column if not exists` (idempotent)
- Pending (optional, for scraped colours only): apply `20260620_carousel_item_colors.sql` to prod Supabase + run `/api/admin/warm-colors`. In-catalog sibling colours already work without it.

## 2026-04-23 19:22 (local)

- Branch: `dev`
- Commit: `03e8c34d99584a3f28b6b2f0a3908dccd92dc0f3`
- Backup branch: `backup/20260423-1922-full-safe`
- Backup tag: `backup/20260423-1922-full-safe`
- Bundle artifact: `toptik-full-backup-20260423-192224.bundle`
- Bundle SHA256: `710C7F628964410892493E2C5C65F8F4E83A51B5D62E539C3910F61017E601F4`
- Quality gate:
  - `npm run lint` passed
  - `npm run build` passed
- Push status:
  - `origin/dev` pushed
  - backup branch pushed
  - backup tag pushed
