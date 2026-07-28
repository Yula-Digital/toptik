#!/bin/bash
# .claude/hooks/user-prompt-submit.sh
# Wired from .claude/settings.json -> UserPromptSubmit.
# Two responsibilities:
#   1. MOS first-prompt activation (fire once per session)
#   2. Playwright trigger detection (fire once per session when relevant)
# Output on stdout is appended to Claude's context as a SYSTEM hint.

set -u

input=""
if [ ! -t 0 ]; then
  input="$(cat)"
fi

# --- Extract user prompt text from JSON stdin (jq -> python3 fallback -> grep last-resort)
prompt=""
if [ -n "$input" ]; then
  if command -v jq >/dev/null 2>&1; then
    prompt="$(printf '%s' "$input" | jq -r '.prompt // .user_prompt // .message // ""' 2>/dev/null || true)"
  fi
  if [ -z "$prompt" ] && command -v python3 >/dev/null 2>&1; then
    prompt="$(printf '%s' "$input" | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin)
  print(d.get("prompt") or d.get("user_prompt") or d.get("message") or "")
except Exception:
  pass' 2>/dev/null || true)"
  fi
  if [ -z "$prompt" ]; then
    # Last resort — grep first "prompt": "..." occurrence (handles simple cases only).
    prompt="$(printf '%s' "$input" | grep -oE '"prompt"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/^"prompt"[[:space:]]*:[[:space:]]*"//; s/"$//')"
  fi
fi

session_id="${CLAUDE_SESSION_ID:-default}"

# -----------------------------------------------------------
# 1) MOS first-prompt activation (existing behaviour)
# -----------------------------------------------------------
MOS_MARKER="/tmp/mos_fired_${session_id}"
if [ ! -f "$MOS_MARKER" ]; then
  touch "$MOS_MARKER" 2>/dev/null || true
  echo 'SYSTEM: First prompt of this session. You MUST invoke the multiskill-optimum-saver skill (via the Skill tool, skill name "multiskill-optimum-saver") NOW before answering. Run all 5 steps (config -> complexity -> skills route -> MCPs route -> status panel). After the status panel, address the user request. This is mandatory.'
fi

# -----------------------------------------------------------
# 2) Playwright trigger detection (fires at most once per session)
# -----------------------------------------------------------
PW_MARKER="/tmp/pw_suggested_${session_id}"
if [ ! -f "$PW_MARKER" ] && [ -n "$prompt" ]; then
  # Triggers cover: UI/layout work, scraping, visual verification.
  # English + Hebrew, case-insensitive.
  PW_TRIGGERS='UI|RTL|layout|overflow|responsive|css|hero|carousel|catalog|scrap|scraper|mandarina|shopify|screenshot|browser|playwright|visual[[:space:]]*verif|verify[[:space:]]*visual|e2e|end-to-end|ויזואל|פיקסל|מובייל|סקרייפ|מנדרינה|שופיפיי|תפוס[[:space:]]*מסך|צילום[[:space:]]*מסך|דפדפן|פריסה|פיקסלים|תקן[[:space:]]*UI'

  if printf '%s' "$prompt" | grep -qiE "$PW_TRIGGERS"; then
    touch "$PW_MARKER" 2>/dev/null || true
    cat <<'EOF'
SYSTEM: User prompt matched Playwright triggers (UI / scraping / visual verification). Playwright MCP is NOT loaded in this session.

PROACTIVELY (one short message) ask the user whether to enable Playwright for the upcoming work. Offer two concrete paths:
  (A) Persistent MCP — commit .mcp.json declaring "@playwright/mcp@latest", then start a NEW session (Claude Code on the Web loads MCPs only at session start). Adds ~5-10 s to first prompt of next session while npx fetches the bridge.
  (B) One-shot Bash now — drive the pre-installed playwright at /opt/node22/lib/node_modules/playwright directly (chromium/firefox/webkit are baked into /opt/pw-browsers/). No restart needed; works only within this session and is ad-hoc.

If the user declines or the task is minor, proceed without Playwright. Do NOT raise this offer again in the current session — the marker is set.
EOF
  fi
fi

exit 0
