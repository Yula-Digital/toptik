# Session Handoff — Carousel Image Fix

**Date:** 2026-05-26
**Previous session:** Failed due to infrastructure (proxy + OAuth broken)
**Target repo:** `Yula-Digital/toptik`
**Production URL:** `toptik-iota.vercel.app/carousel`

---

## TL;DR — What needs to happen

Verify and fix carousel product image CSS in `src/app/globals.css` on **master** branch. Commit + push to master → Vercel auto-deploys.

The carousel route is `/carousel` (NOT `/catalog`, even though CSS classes use `catalog-card-*`).

---

## Required final state of CSS

In `src/app/globals.css`, both desktop and mobile rules must look like this:

### Desktop (around line 513)
```css
.catalog-card-image-wrap {
  grid-column: 2;
  grid-row: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: #ece5d1;   /* cream background */
  overflow: hidden;
}

.catalog-card-image {
  display: block;
  width: 100%;
  height: 100%;
  margin: 0;
  object-fit: contain;
  mix-blend-mode: multiply;   /* makes white product-photo bg blend into cream */
  background: transparent;
  border: none;
  border-radius: 0;
  /* NO transform: scale() — causes clipping */
}
```

### Mobile (inside `@media (max-width: 767px)`, around line 1177)
```css
.catalog-card-image-wrap {
  grid-column: 1;
  grid-row: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  cursor: pointer;
  background: #ece5d1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.catalog-card-image {
  border: 0;
  border-radius: 0;
  object-fit: contain;
  mix-blend-mode: multiply;
  background: transparent;
  /* NO transform: scale() */
}
```

---

## Why these properties matter

| Property | Why |
|---|---|
| `background: #ece5d1` on wrap | Cream color = page bg. Product photo whitespace blends in. |
| `mix-blend-mode: multiply` on image | White pixels in the product photo become transparent against the cream bg |
| `background: transparent` on image | Required for blend mode to work |
| `object-fit: contain` | Keeps product aspect ratio — no distortion or crop |
| `overflow: hidden` on wrap | Safety against any overflow |
| **NO `transform: scale(1.4)`** | Was added previously to make products bigger, but **clips tall items** (trolley, backpack). With `multiply` blend, scale is no longer needed because the white space is invisible — the product appears to "float" larger naturally. |

---

## Current state of local repo (verified before handoff)

The branch `claude/friendly-faraday-bkZfV` and `master` are **identical** at commit `9b7a467`.

Current `.catalog-card-image` in BOTH branches has:
```css
border: var(--card-frame) solid rgba(255, 255, 255, 0.98);
border-radius: 10px;
background: #fff;
```

**This is the OLD version** — no `mix-blend-mode`, no scale, no cream bg. Production (`toptik-iota.vercel.app`) was reportedly showing a NEWER version with `mix-blend-mode: multiply` + `transform: scale(1.4)` deployed by another agent — but **that version is NOT in git master.** There's a mismatch somewhere (possibly the agent committed but didn't push, or pushed to a different branch).

### First step in new session: verify the real state of master

```bash
git fetch origin master
git log origin/master -5
git show origin/master:src/app/globals.css | grep -A 15 "^\.catalog-card-image" | head -50
```

If master in git matches what's described above (with `background: #fff` + border), then we need to apply the FULL change (mix-blend-mode + cream bg).
If master already has `mix-blend-mode` but still has `transform: scale(1.4)`, then only remove the scale lines.

---

## Infrastructure issues in previous session (DO NOT REPEAT)

1. **Git proxy died:** The session-local proxy at `http://local_proxy@127.0.0.1:PORT` stopped responding mid-session. Cannot be revived in the same session. Fresh session = fresh proxy.

2. **GitHub MCP OAuth broken:** Auth URL kept redirecting to a Google Drive install page instead of GitHub. Could not authenticate.

3. **Vercel was disconnected** after repo transfer from `rordan-ai` → `Yula-Digital`. **Already fixed** — Vercel is now connected to `Yula-Digital/toptik` master and auto-deploys on push.

4. **GitHub App `rordan-ai`** is installed on `Yula-Digital` org with access to `toptik`. **Already fixed.**

So in the new session: push should just work via the fresh git proxy. If it doesn't, use GitHub MCP web tools (search for `mcp__github__*`).

---

## Commit message convention

Look at recent commits — style is conventional commits:
```
fix(carousel): use multiply blend mode + cream bg, remove scale clipping
```

---

## After pushing

1. Wait ~1-2 min for Vercel auto-deploy
2. User will visually verify at `toptik-iota.vercel.app/carousel`
3. Check that tall products (trolley/backpack) are no longer clipped at top/bottom
4. Check that white product backgrounds blend into the cream page

---

## MOS setting

User runs MultiSkill Optimum Saver at **MEDIUM (level 3), score 73/140**. Declare at start of each response:
```
🧠 MOS [MEDIUM] · score 73/140
```

---

## User language

User communicates in **Hebrew**. Respond in Hebrew. Project UI is RTL Hebrew.

---

## Project tech stack reminder

- Next.js 16.2.3 (read `node_modules/next/dist/docs/` if making framework changes — APIs may differ from training data)
- React 19
- Tailwind v4
- TypeScript
- Deployed to Vercel from `Yula-Digital/toptik` master

---

## AGENTS.md rule already added (keep it)

```
<!-- BEGIN:carousel-image-rules -->
# Carousel product images — CSS rules (DO NOT revert)
.catalog-card-image-wrap must have overflow:hidden, align/justify: center, background: #ece5d1.
.catalog-card-image must have mix-blend-mode: multiply, background: transparent.
Do not add transform: scale() — causes clipping.
<!-- END:carousel-image-rules -->
```

If missing in `AGENTS.md`, add it.
