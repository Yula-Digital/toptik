#!/bin/bash
# SessionStart hook — forces every session to read the backup/deploy rules, and
# makes the quality gate runnable in fresh Claude-Code-on-the-web containers
# (node_modules is not committed). Output goes to the session context.
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"

# Install deps only on the web, and only if missing (idempotent, quiet).
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ ! -d "$PROJECT_DIR/node_modules" ]; then
  (cd "$PROJECT_DIR" && npm install --no-audit --no-fund) >/dev/null 2>&1 || true
fi

cat <<'NOTE'
⚠️ TOPTIK MANDATORY: read .claude/BACKUP-RULES.md before any commit checkpoint or
production deploy. Backup = commit + push to Git (origin); for a restore point
add a backup branch + annotated tag `backup/<ts>` pushed to origin. Deploys serve
from `master` via Vercel (feature → ff-merge → push master). Gate: `npm run lint`
+ `npm run build`. No local .bundle files or downloads are needed.
NOTE
