---
name: multiskill-optimum-saver
description: MOS V3 - Session optimizer + automatic skill/MCP router. Step 1 optimizes session config (model, thinking, caveman). Step 2 analyzes the first user message and silently invokes relevant skills + MCPs. Trigger automatically on session start, or on /governor, /mos-status, "what's my config".
---

# MULTISKILL OPTIMUM SAVER V3

**Version:** 3.0.0
**Always-active intent:** yes (enforced via `UserPromptSubmit` hook in `.claude/settings.json`)
**Declaration:** at the very top of every response, print `🧠 MOS [<level>] · score <n>/140`.

---

## Step 1 — Read Config

```bash
cat ~/.claude/session-config.json 2>/dev/null || echo "CONFIG_NOT_FOUND"
```

Defaults if not found: `model=sonnet`, `caveman=lite`, `thinking=low`, `subagents=3 (haiku)`, `compact_threshold=60`.

**Score components:**

- model: `haiku=18`, `sonnet=58`, `opus=100`
- thinking: `off=0`, `low=8`, `high=22`, `max=38`
- caveman: `off=0`, `lite=-2`, `full=-8`, `ultra=-16`
- subagents: `n × (haiku=4 | sonnet=7)`, capped at `28`

Score is normalized to a /140 scale for the status panel.

---

## Step 2 — Session Complexity

```bash
find . \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | wc -l
git log --oneline -3 2>/dev/null
head -20 CLAUDE.md 2>/dev/null || head -20 .claude/CLAUDE.md 2>/dev/null
```

| Complexity | Min Score | Signals |
|---|---|---|
| Simple | 18 | question, translation, summary |
| Low | 32 | fix, small change |
| Medium | 55 | refactor, feature, debug |
| Med-High | 75 | architecture, integration, agent |
| High | 90 | rewrite, multi-agent, whole project |

---

## Step 3 — Auto-route: SKILLS

Analyze the user's FIRST message. Silently note (and invoke when relevant) skills matching these triggers:

### Group A — Documents

| Triggers | Skill |
|---|---|
| Word, docx, document, report, letter | `docx` |
| PDF, merge, sign, forms | `pdf` |
| Excel, spreadsheet, budget, data table | `xlsx` |
| slides, presentation, deck, PowerPoint | `pptx` |

### Group B — Design & UI

| Triggers | Skill |
|---|---|
| CSS, z-index, stacking, RTL, layout broken, overflow, sticky, fixed | `css-expert` |
| mobile, iOS, Android, responsive, safe area | `mobile-responsiveness-inspector` |
| poster, visual design, art, illustration, banner | `canvas-design` |
| Figma, UX, wireframe, design critique, accessibility | `design:design-critique` |
| WCAG, a11y, accessibility audit | `design:accessibility-review` |
| handoff, spec, design tokens | `design:design-handoff` |
| design system, component library | `design:design-system` |
| UX copy, microcopy, CTA, error message | `design:ux-copy` |
| user research, interviews, usability test | `design:user-research` |
| research synthesis, themes, insights | `design:research-synthesis` |

### Group C — Marketing

| Triggers | Skill |
|---|---|
| ad, creative, campaign, copy, advertising | `ad-creative-brief` |
| blog, article, social, newsletter, landing page, content | `marketing:content-creation` |
| email sequence, drip, onboarding flow | `marketing:email-sequence` |
| SEO, keywords, audit, organic | `marketing:seo-audit` |
| campaign plan, go-to-market, launch | `marketing:campaign-plan` |
| brand review, brand voice, style guide | `marketing:brand-review` |
| performance report, metrics, channel | `marketing:performance-report` |
| competitive analysis, positioning | `marketing:competitive-brief` |

### Group D — Sales

| Triggers | Skill |
|---|---|
| cold email, outreach, prospect | `sales:draft-outreach` |
| call prep, meeting with, client | `sales:call-prep` |
| call summary, notes, transcript | `sales:call-summary` |
| pipeline, deals, forecast | `sales:pipeline-review` |
| battlecard, competitive intel, vs competitor | `sales:competitive-intelligence` |
| sales asset, one-pager, deck for client | `sales:create-an-asset` |
| account research, company intel | `sales:account-research` |
| daily briefing, morning, what's on my plate | `sales:daily-briefing` |

### Group E — Legal

| Triggers | Skill |
|---|---|
| NDA, confidentiality | `legal:triage-nda` |
| contract review, MSA, SOW | `legal:review-contract` |
| compliance, GDPR, regulatory | `legal:compliance-check` |
| legal risk, exposure, liability | `legal:legal-risk-assessment` |
| legal response, data subject, subpoena | `legal:legal-response` |
| vendor agreement, vendor check | `legal:vendor-check` |
| legal brief | `legal:brief` |
| meeting brief, negotiation prep | `legal:meeting-briefing` |
| signature, e-sign, DocuSign | `legal:signature-request` |

### Group F — Finance

| Triggers | Skill |
|---|---|
| journal entry, accrual, debit, credit | `finance:journal-entry` |
| financial statements, P&L, balance sheet | `finance:financial-statements` |
| variance analysis, budget vs actual | `finance:variance-analysis` |
| reconciliation, GL, subledger | `finance:reconciliation` |
| SOX, audit, controls | `finance:sox-testing` |
| month-end close, close calendar | `finance:close-management` |

### Group G — Product & Operations

| Triggers | Skill |
|---|---|
| PRD, spec, feature requirements | `product-management:write-spec` |
| roadmap, prioritize, now/next/later | `product-management:roadmap-update` |
| sprint planning, backlog, capacity | `product-management:sprint-planning` |
| metrics review, KPIs, dashboard | `product-management:metrics-review` |
| stakeholder update, status report | `product-management:stakeholder-update` |
| user research synthesis, feedback | `product-management:synthesize-research` |
| process, SOP, runbook, RACI | `operations:process-doc` |
| process optimization, bottleneck | `operations:process-optimization` |
| risk assessment, risk register | `operations:risk-assessment` |
| vendor review, TCO, renew | `operations:vendor-review` |
| change request, CAB, deployment | `operations:change-request` |
| status report, weekly update | `operations:status-report` |
| capacity plan, headcount | `operations:capacity-plan` |

### Group H — Technical (always-on candidates)

| Triggers | Skill |
|---|---|
| context > 60%, memory full | `strategic-compact` |
| short, concise, fewer tokens | `caveman` |
| web artifact, React component, HTML | `web-artifacts-builder` |
| plugin, skill create | `skill-creator` |
| documentation, co-author | `doc-coauthoring` |

---

## Step 4 — Auto-route: MCPs

Silently surface relevant MCP servers based on the first message:

| Triggers | MCP |
|---|---|
| browser, web test, playwright, scrape, screenshot of site | `playwright` |
| GitHub, PR, repo, commit, code review, issue | `github` |
| Figma, design file, component, frame | Figma MCP |
| Google Drive, Docs, Sheets | Google Drive MCP |
| Slack, channel, message team | Slack MCP |
| Canva, design template | Canva MCP |
| Linear, ticket, issue, sprint | Linear MCP |
| Notion, page, database, wiki | Notion MCP |
| Vercel, deploy, production, logs | Vercel MCP |
| email, Gmail, inbox | Gmail MCP |

If an MCP is needed but not connected, note: `[MCP needed: X — not connected. /connect to add]`.

---

## Step 5 — Display Status

After the analysis above, print the status panel (one time, at top of the response, right after the MOS declaration line):

```
╔═ MOS V3 ══════════════════════════════════════╗
║  Model: [model]       Sub: [sub_model]x[n]    ║
║  Caveman: [level]     Thinking: [level]       ║
║  Compact@: [n]%       Score: [score]/140      ║
╠═══════════════════════════════════════════════╣
║  Session: [complexity]  Detected: [reason]    ║
║  Status: [OK / borderline / MISMATCH]         ║
╠═══════════════════════════════════════════════╣
║  Skills: [skill1, skill2, ... | none]         ║
║  MCPs:   [mcp1, mcp2, ... | none]             ║
╚═══════════════════════════════════════════════╝
```

---

## Step 6 — Config Recommendation (only if mismatch)

```
Config tuned for [current level], session requires [detected level].
Suggested changes:
  model:         [current] -> [recommended]
  thinking:      [current] -> [recommended]
  caveman_level: [current] -> [recommended]
  max_subagents: [current] -> [recommended]
```

Type `yes` / `approve` to apply. `no` to keep current.

**Presets:**

| Complexity | model | caveman | thinking | subagents |
|---|---|---|---|---|
| Simple | haiku | ultra | off | 0 |
| Low | sonnet | full | off | 1 |
| Medium | sonnet | lite | low | 3 |
| Med-High | sonnet | lite | high | 4 |
| High | opus | off | high | 5 |

---

## Step 7 — Apply on Approval

```bash
cat > ~/.claude/session-config.json << 'EOF'
{
  "model_default": "[recommended]",
  "subagent": { "model": "[sub]", "max": [n], "parallel": true },
  "caveman": { "enabled": true, "level": "[level]" },
  "compact_threshold": [n],
  "extended_thinking": "[level]",
  "max_thinking_tokens": [n]
}
EOF
export ANTHROPIC_MODEL="[model]"
export CLAUDE_CODE_SUBAGENT_MODEL="[sub_model]"
```

**Note:** model/env changes affect future sessions, not the current one (model selection is locked at session start).

---

## Session Commands

| Command | Action |
|---|---|
| `/governor` | Show current config status |
| `/mos-status` | Same as `/governor` |
| `/mos-preset [level]` | Apply preset |
| `/mos-reset` | Restore defaults |
| `/mos-save` | Save current config as default |
| `/mos-skills` | Show skills activated this session |
