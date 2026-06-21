#!/usr/bin/env bash
# One-click LOCAL demo of the TOPTIK admin panel — no Supabase / DB needed.
# Usage (from inside the cloned repo):  ./scripts/start-demo.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run, ~1 min)..."
  npm install
fi

export PANEL_DEMO=1
echo ""
echo "  TOPTIK admin demo is starting."
echo "  When you see 'Ready', open:  http://localhost:3000/dashboard"
echo ""
npm run dev
