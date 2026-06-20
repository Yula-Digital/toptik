# דף הנחיתה עובר ל‑landing.toptik.co.il — Runbook

> **רקע (2026-06-20):** השורש `toptik.co.il` הוחזר לחנות Shopify (בוצע ב‑DNS).
> דף הנחיתה (אפליקציית Next על Vercel, פרויקט `toptik`) **לא נעלם** — הוא רק
> צריך בית חדש: תת‑הדומיין **`landing.toptik.co.il`**.
> מסמך זה הוא ה‑record + הרצף המדויק לביצוע. השלמת DNS+Vercel = **בתהליך**.

---

## 0. עובדת המפתח (שלא ליפול עליה)

`216.150.1.1` הוא **ה‑IP המשותף של Vercel**, לא "שרת דף הנחיתה" נפרד. Vercel
מנתב **לפי שם המארח (Host header)** ומגיש דומיין רק אם הוא **רשום בפרויקט**.
לכן רשומת `A` בודדת אל `216.150.1.1` **לא תספיק** ולא תציג את הדף — תתקבל שגיאת
"domain not configured" של Vercel. הדרך הנכונה לסאב‑דומיין היא **CNAME → Vercel**,
**אחרי** שהדומיין נוסף בפרויקט. בדיוק כמו ש‑`www` כבר עובד (CNAME, לא A).

---

## 1. מצב נוכחי

| פריט | ערך |
|---|---|
| פרויקט Vercel | `toptik` · `prj_7LROyMek3LBhb16a9e4A4EyJNhJy` |
| Team | `rordan-ais-projects` · `team_OOyctgp7Iroyd2ONA9sy9XJL` |
| דומיינים בפרויקט כיום | `toptik.co.il`, `www.toptik.co.il`, `*.vercel.app` — **`landing` עדיין לא קיים** |
| ניהול DNS | internic / sitesdepot — `https://portal.internic.co.il` (zone 7144) |
| שורש `toptik.co.il` | הוחזר ל‑Shopify (DNS) |
| כתובת אימות זמנית (עד שה‑CNAME עולה) | `https://toptik-iota.vercel.app` — אותו פרודקשן, עובד תמיד |

---

## 2. מה צריך לקרות (סדר מחייב)

הסדר חשוב: ערך ה‑CNAME המדויק מגיע **מ‑Vercel אחרי ההוספה**.

### שלב א' — ב‑Vercel (ידני בדשבורד; אין API לזה)
1. `https://vercel.com/rordan-ais-projects/toptik/settings/domains`
2. **Add Domain** → `landing.toptik.co.il` → Add.
3. Environment = **Production** (לא redirect, לא branch אחר).
4. Vercel יציג רשומת **CNAME** עם **ערך יעד מדויק** (מהמשפחה `*.vercel-dns-017.com`,
   כמו שה‑`www` משתמש ב‑`59246325c2db1707.vercel-dns-017.com.`). **העתק את הערך הזה.**
   הסטטוס יהיה "Invalid Configuration" עד שרשומת ה‑DNS תעלה — זה תקין בשלב הזה.

### שלב ב' — ב‑internic (רשומת DNS אחת; מבוצע ע"י סוכן ה‑DNS)
- **סוג:** `CNAME`
- **שם:** `landing`
- **ערך:** הערך המדויק מ‑Vercel (שלב א'.4). אם לא זמין — גנרי עדכני `cname.vercel-dns-0.com.`
- **TTL:** `3600`
- **אסור:** `A → 216.150.1.1` לסאב‑דומיין. לא לגעת בשורש, ב‑`www`, וברשומות
  האימייל/אימות (`MX`, `SPF/TXT`, `*._domainkey`, `dmarc`, `mailerlul`, `ftp`, `NS`).

### שלב ג' — אימות
- `dig landing.toptik.co.il +short` → משרשר ל‑CNAME של Vercel.
- ב‑Vercel: הדומיין הופך ל‑**Valid Configuration** + SSL מונפק (דקות עד שעה).
- דפדפן: `https://landing.toptik.co.il` ו‑`https://landing.toptik.co.il/carousel` נטענים עם מנעול.

---

## 3. קוד

- `src/app/layout.tsx` — נוסף `metadataBase: https://landing.toptik.co.il`
  (canonical/OG מצביעים לבית החדש). אין שום ערך דומיין מקודד אחר באפליקציה — היא
  תעבוד על הסאב‑דומיין ללא שינוי נוסף.
- פרסום: כרגיל, feature → `npm run verify` → ff‑merge ל‑`master` → Vercel בונה ~90ש'.

---

## 4. Rollback / ניקוי אופציונלי

- **לבטל את הסאב‑דומיין:** הסר את רשומת ה‑CNAME `landing` ב‑internic + הסר את
  הדומיין מהפרויקט ב‑Vercel.
- **ניקוי שאריות (אופציונלי, לא חוסם):** השורש `toptik.co.il` ו‑`www` עדיין
  מחוברים לפרויקט Vercel למרות שה‑DNS שלהם מצביע ל‑Shopify. אפשר להסיר אותם
  מ‑Settings → Domains כדי למנוע בלבול. ה‑`www` היום מוגדר Redirect 308 → apex,
  כך שאם ה‑DNS שלו עדיין → Vercel הוא יקפיץ ל‑Shopify; אם רוצים `www` → Shopify
  ישירות, החזר אצל סוכן ה‑DNS את `CNAME www → shops.myshopify.com.`.

---

## 5. רקע מלא

ההיסטוריה של המעבר ההפוך (toptik.co.il → Vercel ב‑2026-06-18) והעוגנים ל‑rollback
מתועדים ב‑`docs/DOMAIN-MIGRATION.md`.
