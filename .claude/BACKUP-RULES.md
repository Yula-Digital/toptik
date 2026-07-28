# TOPTIK — Backup & Deploy Rules (MANDATORY READ)

Surfaced at every session start by `.claude/hooks/session-start.sh`. Read before
any commit checkpoint or production deploy. Full standard: `docs/backup-and-recovery.md`.

## Backup = Git + Vercel (no local files, no downloads)
- The code is backed up by **committing and pushing to `origin`** (GitHub).
- For a restore point at a milestone, create a **backup branch + annotated tag**
  `backup/YYYYMMDD-HHMM[-label]` and push **both to `origin`** — that is the
  durable checkpoint.
- Vercel keeps deployment history for rollback. Routine code backups need **no
  `.bundle` files and no local downloads**.

## Quality gate (before deploy)
- `npm run lint` must pass.
- `npm run build` must pass.

## Deploy
- Production serves from `master` via Vercel. **Never** push to `master` code
  that has not passed the gate on the feature branch. Always feature →
  `git merge --ff-only` → push `master` (see `AGENTS.md`).

## Rollback
- Redeploy a previous Vercel deployment, or check out the latest `backup/...` tag.
