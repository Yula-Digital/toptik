# Backup Audit Log

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
