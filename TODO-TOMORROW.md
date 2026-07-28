# TODO — מחר (משימות תפעוליות, לא פיתוח)

> כל **הקוד** של פאנל האדמין (כולל כספת הסיסמאות + סוכן וואטסאפ) כבר כתוב, עבר
> `npm run verify`, ונדחף לענף **`claude/hopeful-cannon-6epcmb`**.
> הרשימה כאן היא רק הצעדים שצריך לבצע **במערכות חיצוניות** (GitHub / Vercel /
> internic / Supabase) — אי אפשר לעשות אותם מסביבת הפיתוח הארעית.
> פרטים מלאים: `docs/ADMIN-SUBDOMAIN.md`, `docs/LANDING-SUBDOMAIN.md`.

---

## 1. ניקוי GitHub
- [ ] למחוק את ענף הגיבוי המיותר מ‑origin:
  ```
  git push origin --delete backup/20260620-2113-admin-panel
  ```
  (מצביע לאותו commit כמו ענף הפיצ'ר — מחיקה לא מאבדת כלום. נחסם לי מהסביבה.)

## 2. הוק קריאת כללי הגיבוי (אופציונלי)
- [ ] לרשום את ה‑SessionStart hook ב‑`.claude/settings.json` (קובץ ההוק וקובץ
  הכללים כבר ב‑repo; הרישום נחסם ע"י מסווג הבטיחות). בלי זה הכל עובד — זה רק
  כדי שסוכן עתידי יקרא אוטומטית את כללי הגיבוי.

## 3. פריסת הפאנל לאוויר
- [ ] **מיזוג ל‑master** (כשסוכן השורש מסיים את עבודתו): `feature → master`
  (ff‑merge) → Vercel בונה ~90ש'. כך גם האדמין נכנס לגיבוי הראשי של האפליקציה.
- [ ] **Vercel** → פרויקט `toptik` → Settings → Domains → **Add** `admin.toptik.co.il`
  (Environment = Production). להעתיק את ערך ה‑CNAME שמוצג.
- [ ] **internic** (zone 7144) → להוסיף `CNAME` · שם `admin` · ערך = מה ש‑Vercel
  הציג (משפחת `*.vercel-dns-017.com`, או זמנית `cname.vercel-dns-0.com.`) · TTL 3600.
  בדיוק כמו ש‑`landing` הוגדר. **לא** רשומת A.

## 4. משתני סביבה ב‑Vercel (Production)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `ADMIN_PANEL_TOKEN` (לשלב ה‑`/setup` החד‑פעמי)
- [ ] `ADMIN_VAULT_KEY` — מפתח 32‑בייט base64 לכספת. יצירה:
  ```
  openssl rand -base64 32
  ```
- [ ] `CRON_SECRET` (אם עוד לא מוגדר — ל‑cron של tech‑specs)

## 5. Supabase
- [ ] להריץ את המיגרציה `supabase/migrations/20260620_admin_vault.sql`
  (טבלת `admin_vault_entries` לכספת — ciphertext בלבד, RLS חוסם הכל).
- [ ] Auth → URL Configuration → להוסיף Redirect URL:
  `https://admin.toptik.co.il/auth/callback` (להזמנות / איפוס סיסמה / OTP).
- [ ] לוודא ש‑Email OTP מופעל (ברירת מחדל — כבר פעיל כי איפוס הסיסמה עובד).

## 6. יצירת משתמש האדמין הראשון — רמי אורדן
- [ ] Supabase Dashboard → **Authentication → Users → Add user**:
  - email: `rordan@gmail.com`
  - password: **6+ תווים** (⚠️ `4551` נדחה — קצר מדי)
  - לסמן **Auto-confirm user**
  - (חלופה: דרך `/setup` בפאנל אחרי הפריסה — דורש את `ADMIN_PANEL_TOKEN`)
- [ ] להתחבר ב‑`https://admin.toptik.co.il` עם המייל + הסיסמה.

## 7. אופציונלי / שיפורים
- [ ] להשבית **Vercel Authentication** על Preview כדי שכתובות תצוגה‑מקדימה
  ייפתחו (Settings → Deployment Protection).
- [ ] אם רוצים שענפי `backup/*` לא יפעילו פריסות Preview ב‑Vercel — להוסיף
  "Ignored Build Step" שמדלג עליהם, או לעבוד עם תגיות בלבד.

---

✅ **כבר בוצע (לא צריך לגעת):** סוכן הוואטסאפ מחובר ל‑`https://agent.toptik.co.il/`;
קישורי הגלריה/לנדינג/שופיפיי/internic/Vercel/GitHub מוגדרים; הלוגו האמיתי מושתל.
