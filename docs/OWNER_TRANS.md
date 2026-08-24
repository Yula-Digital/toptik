# העברת בעלות האתר ללקוח — צ'ק-ליסט מלא (OWNER_TRANS)

עודכן: 2026-08-15

> מסמך זה נמצא בריפו **ציבורי** — לכן הוא מכיל **רק שמות** של משתני סביבה ורכיבים,
> אף פעם לא ערכים/מפתחות סודיים. את הערכים בפועל שולפים מה-dashboards.

## מטרה
העברת בעלות מלאה של האתר לארגון הלקוח (**toptikorg**), כך ש:
- הלקוח בעלים מלא של **כל** הרכיבים (קוד · אירוח · מסד נתונים · דומיין).
- המפתח (**rordan-ai**) **ממשיך לפתח** — שומר גישת Developer בכל רכיב.
- אין הפסקת שירות.

## מפת הרכיבים
| רכיב | ספק | מצב נוכחי (rordan) | יעד (לקוח) | סטטוס |
|---|---|---|---|---|
| קוד | GitHub | rordan-ai/toptik | **toptikorg/toptik** | ✅ הועבר |
| אירוח + cron | Vercel | team `rordan-ais-projects` | **team `toptik` (Pro)** | ✅ הועבר 2026-08-24 |
| מסד נתונים + אחסון | Supabase | פרויקט של rordan | org של הלקוח | ⏳ |
| דומיין + DNS | internic → sitesdepot | rordan | לקוח | ⏳ |

> **סטטוס ההעברה ל-Vercel (בוצע 2026-08-24):** הפרויקט הועבר לטים `toptik` (Pro) של הלקוח.
> אומת: 8/8 env vars עברו · דומיינים admin+landing תקינים · git מחובר ל-toptikorg/toptik ·
> האתר וה-API חיים · Speed Insights כובה לפני ההעברה (חוסך ללקוח 10$/ח'). גיבוי מלא של
> ערכי ה-env נשמר מקומית אצל rordan (`.env.production-backup`, מחוץ ל-git).

> **חשוב על "משקל" האתר:** זו אפליקציית Next.js צד-שרת (21 API routes, אימות אדמין,
> `sharp` לעיבוד תמונות, 2 cron, middleware לתת-דומיינים). היא **חייבת** מנוע שמריץ
> Node.js מלא — לא אחסון שיתופי/cPanel סטטי. לכן נשארים ב-Vercel.

---

## 1. Git — ✅ הועבר (נשאר רק לחבר ל-Vercel)
- הריפו: `github.com/toptikorg/toptik` (owner = ארגון הלקוח).
- ל-rordan-ai יש **admin** על הריפו → ממשיך לפתח ולדחוף. הכתובת הישנה עושה redirect.
- **נשאר:** לחבר את פרויקט ה-Vercel של הלקוח לריפו הזה — סעיף 2.4.
- workflow פיתוח (לא משתנה): עבודה על branch → `git merge --ff-only` ל-`master` → push → Vercel פורס אוטומטית ל-`landing.toptik.co.il`.

## 2. Vercel — Transfer Project (ליבת ההעברה)
### 2.1 הכנה (הלקוח)
- [ ] הלקוח נרשם ל-Vercel, יוצר **Team**, משדרג ל-**Pro** (~20$/חודש).
- [ ] הלקוח מזמין את `rordan-ai` כ-**Member**: `Team → Settings → Members → Invite`.
- [ ] rordan-ai מאשר את ההזמנה מהמייל. *(חובה — אי אפשר להעביר לטים שאינך חבר בו.)*

### 2.2 ביצוע ההעברה (rordan-ai)
- [ ] Vercel → team `rordan-ais-projects` → project **toptik** → **Settings** → אזור **Transfer** (בתחתית).
- [ ] בחר את **הטים של הלקוח** → אשר (הקלד את שם הפרויקט לאישור).
- הפריסות, הדומיינים וה-env **עוברים עם הפרויקט**.

### 2.3 משתני סביבה — לוודא שכולם עברו ⚠️ (הנקודה שהכי מפילה העברות)
המקור המוסמך: **Vercel → Settings → Environment Variables**. הרשימה הבאה נגזרה מהקוד (`process.env`)
— אלה **כל** המשתנים שהאתר צורך ב-production. 🔒 = סוד.

**סודות (Server) — לגבות ראשונים:**
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 🔒 — בלעדיו כתיבות אדמין/ייבוא נשברים
- [ ] `ADMIN_PANEL_TOKEN` 🔒 — אימות ה-API של האדמין
- [ ] `ADMIN_VAULT_KEY` 🔒🔒 — **הכי קריטי:** מפענח את כספת הסיסמאות (AES-256-GCM). **אם המפתח אובד — כל הסיסמאות בכספת אבודות לצמיתות, ללא שחזור.** גבה אותו ראשון ובזהירות.
- [ ] `CRON_SECRET` 🔒 — אימות ה-cron

**ציבוריים (`NEXT_PUBLIC_*`):**
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `NEXT_PUBLIC_ENABLE_CAROUSEL`
- [ ] `NEXT_PUBLIC_ADMIN_HOST`
- [ ] `NEXT_PUBLIC_LANDING_URL`
- [ ] `NEXT_PUBLIC_GALLERY_EDITOR_URL`
- [ ] `NEXT_PUBLIC_SHOPIFY_ADMIN_URL`
- [ ] `NEXT_PUBLIC_WHATSAPP_AGENT_URL`
- [ ] `NEXT_PUBLIC_GITHUB_URL`
- [ ] `NEXT_PUBLIC_INTERNIC_URL`
- [ ] `NEXT_PUBLIC_VERCEL_URL`

**לא צריך להעביר:** `NODE_ENV` (Vercel מגדיר אוטומטית), `PANEL_DEMO` (dev-only בלבד).

> ⚠️ רק 5 מהם קיימים ב-`.env.local` המקומי — **9 מוגדרים רק ב-Vercel** (כולל `ADMIN_VAULT_KEY`
> ו-`CRON_SECRET`). **לפני שלוחצים Transfer:** בעודך Member בטים הישן, העתק את הערכים של כולם
> מ-Vercel למקום בטוח. ב-Transfer הם אמורים לעבור אוטומטית, אבל אם אחד מפספס — הגיבוי מציל.

### 2.4 חיבור GitHub — ✅ הושלם ואומת
- [x] `Settings → Git` מחובר ל-`toptikorg/toptik` (נותק וחובר מחדש אחרי ה-Transfer).
- [x] **Vercel GitHub App** מותקן על הארגון `toptikorg` (Repository access: All repositories).
- [x] **Ignored Build Step תוקן** — הפרויקט נשא סקריפט bash ישן שהתנה בנייה ב-slug/owner
  של הריפו הישן; מאז העברת הריפו ל-toptikorg (17.8) כל פריסה נוצרה ו**בוטלה תוך שניות**
  (נראה רק כשמסמנים סטטוס "Canceled" בפילטר). הוחלף ל-**Automatic**.
- [x] אומת end-to-end: דחיפה ל-master → build → **Ready + Production** בטים החדש.

### 2.5 דומיינים
- [ ] `admin.toptik.co.il` + `landing.toptik.co.il` עוברים עם הפרויקט.
- [ ] אם מופיע "Invalid Configuration" → **Verify** (ה-DNS לא משתנה, רק האימות בצד Vercel).

### 2.6 Cron
- 2 משימות יומיות (`warm-tech-specs`, `warm-colors`) — עוברות אוטומטית (מוגדרות ב-`vercel.json` שבקוד). דורש Pro לתזמון אמין.

### 2.7 שמירת גישת פיתוח שלך
- [ ] הלקוח משאיר את `rordan-ai` כ-**Member** בטים → יכול לפרוס ולפתח כרגיל.

## 3. Supabase (נפרד מ-Vercel — לא עובר איתו!)
מסד הנתונים + אחסון התמונות (bucket `carousel-media`) חיים בפרויקט Supabase נפרד.
### אפשרות מומלצת — Transfer project ל-org של הלקוח
- [ ] הלקוח יוצר **Organization** ב-Supabase.
- [ ] בעל הפרויקט הנוכחי: `Project Settings → General → Transfer project` → org של הלקוח.
- [ ] ה-keys (URL / anon / service_role) **נשארים זהים** אחרי Transfer → אין צורך לעדכן env.
### לחלופין — הזמנה כ-Owner
- [ ] `Organization → Team → Invite` → תפקיד Owner ללקוח.
### גישת פיתוח שלך
- [ ] `rordan-ai` נשאר **Member** בפרויקט Supabase (גישה ל-DB/Studio/מיגרציות).
- ⚠️ אם מבצעים **rotate** למפתחות — לעדכן מיד את ה-env התואמים ב-Vercel, אחרת האתר נשבר.

## 4. דומיין + DNS
- `toptik.co.il` apex → **Shopify** (הוחזר). תת-הדומיינים `landing` + `admin` → Vercel (CNAME).
- DNS מנוהל ב-**internic → sitesdepot**. רשומות **MX/SPF (Google Workspace)** ו-Shopify — **לא לגעת**.
- רקע מלא: `docs/DOMAIN-MIGRATION.md`, `docs/LANDING-SUBDOMAIN.md`, `docs/ADMIN-SUBDOMAIN.md`.
### אם בעלות הדומיין עוברת ללקוח
- [ ] להעביר/לשתף את ניהול ה-DNS (internic/sitesdepot) עם הלקוח.
- [ ] לוודא שה-CNAME של `landing` + `admin` ממשיכים להצביע ל-Vercel.

## 5. סדר פעולות מומלץ (למניעת downtime)
1. **Supabase** קודם — Transfer/הזמנה ל-org הלקוח (ה-keys נשארים → 0 downtime).
2. **Vercel** — הלקוח פותח team Pro → מזמין אותך → Transfer Project → ווידוא env (2.3) + git (2.4) + domains (2.5).
3. **אימות סופי** — סעיף 6.
4. **DNS** — לפי הצורך, אחרון.

## 6. אימות סופי (חובה אחרי ההעברה)
- [ ] `https://landing.toptik.co.il` עולה תקין.
- [ ] `https://admin.toptik.co.il` — התחברות אדמין עובדת (Supabase auth).
- [ ] פאנל האדמין: **כספת הסיסמאות נפתחת** (ADMIN_VAULT_KEY תקין), ייבוא/שמירה עובדים.
- [ ] דחיפת commit ל-`master` → Vercel מפרסם אוטומטית (git connection תקין).
- [ ] למחרת: ה-cron רץ — בדיקה בלוגים של `warm-tech-specs` / `warm-colors`.

## 7. מה נשאר אצל rordan-ai כדי להמשיך לפתח
| רכיב | תפקיד נדרש |
|---|---|
| GitHub `toptikorg/toptik` | admin ✅ (כבר קיים) |
| Vercel (team הלקוח) | Member |
| Supabase (פרויקט) | Member |

כל עוד שלוש הגישות האלה קיימות — הפיתוח ממשיך **בדיוק כמו היום**, בלי קשר לכך שהבעלות עברה ללקוח.
