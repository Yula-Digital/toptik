# Admin panel — `admin.toptik.co.il`

The admin panel is a session-gated control surface served on the **`admin.toptik.co.il`**
subdomain (same Vercel project / `master` deployment as the landing page). It is
**not** the legacy token-only `/admin` editor — that route now redirects into the
new panel.

- Login / password reset: **Supabase Auth** (email + password, hashed, built-in
  recovery email). Up to **3 admin accounts**.
- Routing: handled by `src/proxy.ts` (Next.js 16 renamed Middleware → Proxy).
- Settings storage: `supabase/migrations/20260620_admin_panel.sql`
  (`admin_settings` singleton, service-role only).

## Dashboard menu

| # | Item | Destination |
|---|------|-------------|
| 1 | הגדרות אדמין | `/settings` — manage admin users (invite / remove / reset, max 3) |
| 2 | עדכון גלריית דף הנחיתה | `/gallery` — the carousel editor (session-gated) |
| 3 | דף הנחיתה | `https://landing.toptik.co.il` (new tab) |
| 4 | חנות שופיפיי | `https://toptik.co.il` (new tab) |
| 5 | סוכן וואטסאפ AI | `/settings/whatsapp` — enable/disable + config (UI now, runtime later) |

## Surface / route map

```
admin.toptik.co.il/            → rewritten to /dashboard (→ /login when signed out)
/login        public   email + password sign-in, "forgot password" link
/setup        public   one-time primary-admin creation (guarded by ADMIN_PANEL_TOKEN)
/reset        public   request a reset link, or set a new password (with a session)
/auth/callback route   exchanges the email link (code OR token_hash) → session
/dashboard    gated    the 5-item menu
/settings     gated    manage admin users
/settings/whatsapp gated  WhatsApp AI agent toggle + config
/gallery      gated    carousel editor
```

## One-time deploy / DNS / Supabase setup

> Production serves from `master`, so the panel only goes live after the feature
> branch is fast-forward-merged to `master` (see `AGENTS.md`).

### 1. Vercel — add the domain
In the Vercel project (`rordan-ais-projects/toptik`) → **Settings → Domains**,
add `admin.toptik.co.il`. Vercel will show the DNS record to create.

### 2. DNS — point the subdomain at Vercel
At the DNS host (internic → sitesdepot, zone 7144 — same place as the `landing`
cutover, see `docs/LANDING-SUBDOMAIN.md`), add:

```
CNAME   admin   →   cname.vercel-dns.com.
```

(Use whatever target Vercel shows in step 1. Leave Google Workspace MX/SPF and
Shopify records untouched.) Verify the domain in Vercel once DNS propagates.

### 3. Supabase Auth — redirect URLs
**Authentication → URL Configuration**:

- **Site URL**: `https://admin.toptik.co.il`
- **Redirect URLs** — add: `https://admin.toptik.co.il/auth/callback`

### 4. Supabase Auth — email templates (recommended, robust resets/invites)
By default Supabase recovery/invite links use the PKCE *code* flow, which only
works in the same browser that requested it. For **cross-device and
admin-initiated** resets/invites, switch the two templates to the one-time
**token_hash** flow (the `/auth/callback` handler already supports both).

**Authentication → Email Templates → Reset Password** — set the link to:
```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset
```
**Authentication → Email Templates → Invite user** — set the link to:
```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/reset
```

(Optional) Configure **SMTP** under Auth → SMTP for branded sender / higher
send limits. The built-in Supabase mailer works for low volume.

### 5. Database — run the migration
Apply `supabase/migrations/20260620_admin_panel.sql` (creates `admin_settings`).

### 6. Environment variables (Vercel → Settings → Environment Variables)
Required (most already set for the carousel):

| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (session auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | Create/invite/delete users, settings writes |
| `ADMIN_PANEL_TOKEN` | One-time `/setup` guard + legacy API fallback |

Optional overrides: `NEXT_PUBLIC_ADMIN_HOST` (default `admin.toptik.co.il`),
`NEXT_PUBLIC_LANDING_URL`, `NEXT_PUBLIC_SHOPIFY_URL`.

### 7. First-run — create the primary admin
1. Visit `https://admin.toptik.co.il` → you are redirected to **`/setup`**.
2. Enter the primary admin email, a password (≥ 10 chars), and the
   `ADMIN_PANEL_TOKEN` value. Submit → the owner account is created and you are
   signed in.
3. From **הגדרות אדמין** (`/settings`) invite up to **2 more** admins by email.
   Each invitee receives a link to set their password.

After an owner exists, `/setup` is locked (redirects to `/login`).

## Security notes
- Passwords are hashed and managed by Supabase Auth; the app never stores them.
- `admin_settings` (incl. the WhatsApp access token) is reachable only via the
  service-role client behind session-gated API routes; RLS denies anon /
  authenticated access. The token is never returned to the browser (the API
  reports only whether one is set).
- `ADMIN_PANEL_TOKEN` stays server-side. The new panel uses cookie sessions; the
  legacy static-token path on `/api/admin/*` is kept only for cron/back-compat.
