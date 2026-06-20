# העברת הדומיין toptik.co.il — היסטוריה + rollback

> **⚠️ עודכן 2026-06-20 — בוטל חלקית (הושלם ✅).** השורש `toptik.co.il` **הוחזר לחנות
> Shopify**, ודף הנחיתה (Vercel) **עבר וחי על `landing.toptik.co.il`** — ראה
> **`docs/LANDING-SUBDOMAIN.md`** לרשומה המלאה. המסמך הזה נשאר כ‑**רשומה היסטורית +
> עוגני rollback** של המעבר המקורי מ‑2026-06-18.
>
> **המצב הסופי (2026-06-20):**
> - שורש `toptik.co.il`: היה `A 216.150.1.1` (Vercel) → **Shopify** `A 23.227.38.65`; `www` → `CNAME shops.myshopify.com.`.
> - דף הנחיתה: אותו פרודקשן Vercel, חי על `landing.toptik.co.il` → `CNAME 59246325c2db1707.vercel-dns-017.com.` (Valid + SSL).
> - `216.150.1.1` = ה‑IP של Vercel (לא שרת נפרד); Vercel מנתב לפי Host header — לכן סאב‑דומיין דורש CNAME **+** רישום בפרויקט, לא רשומת A בודדת.

> **רקע מקורי (2026-06-18):** הפרודקשן חי על `https://toptik.co.il` (ו‑`www` מפנה אליו).

---

## 0. מצב נוכחי (אחרי המעבר)

| פריט | ערך |
|---|---|
| **כתובת האתר החיה** | **`https://toptik.co.il`** (`www.toptik.co.il` → 308 → השורש) |
| פרויקט Vercel | `toptik` · `prj_7LROyMek3LBhb16a9e4A4EyJNhJy` |
| Team | `rordan-ais-projects` · `team_OOyctgp7Iroyd2ONA9sy9XJL` |
| ניהול DNS | internic / sitesdepot — `https://portal.internic.co.il` (zone 7144) |
| Nameservers | `ns1.sitesdepot.com` / `ns2.sitesdepot.com` (לא שונו) |
| מתארח על | Vercel; פרסום אוטומטי מ‑branch `master` |
| כתובת ברירת מחדל ישנה | `https://toptik-iota.vercel.app` (עדיין עובדת, מצביעה לאותו פרודקשן) |

---

## 1. מה בוצע ב‑Vercel (Settings → Domains)

| דומיין | הגדרה | סטטוס |
|---|---|---|
| `toptik.co.il` | Connect to environment → **Production** (ראשי) | ✅ Valid + SSL |
| `www.toptik.co.il` | **Redirect 308 → `toptik.co.il`** | ✅ Valid + SSL |

---

## 2. מה בוצע ב‑internic (הרשומות שנקבעו בפועל)

```
שורש (apex):
   A      @     216.150.1.1                            (נוסף)

www:
   CNAME  www   59246325c2db1707.vercel-dns-017.com.   (השתנה מ: shops.myshopify.com)
```

- אלו הערכים הספציפיים שורסל הנפיק לפרויקט. (הגנריים `76.76.21.21` ו‑`cname.vercel-dns.com` עובדים גם כ‑fallback.)
- **לא נגענו (אימייל + אימות, נשארו שלמים):** `NS` · `lul._domainkey` · `lul2._domainkey` · `lul3._domainkey` · `mailerlul` · `ftp` · `dmarc` TXT · ה‑`TXT` SPF על השורש · ה‑`MX` של Google.
- **חנות Shopify:** נשארה חיה בכתובת ה‑`*.myshopify.com` שלה; רק הדומיין `toptik.co.il` עבר להצביע על דף הנחיתה.

---

## 3. אימות (בוצע)

- ✅ Vercel: שני הדומיינים **Valid Configuration** + SSL הונפק.
- בדיקה שוטפת: `https://toptik.co.il` ו‑`https://toptik.co.il/carousel` נטענים עם מנעול; `www` מפנה לשורש.
- בדיקת DNS חיצונית (במידת הצורך): `dig toptik.co.il +short` → `216.150.1.1` · `dig www.toptik.co.il +short` → `59246325c2db1707.vercel-dns-017.com.`

---

## 4. נקודת גיבוי / Rollback (אם אי פעם צריך לחזור אחורה)

- **קוד:** commit `fdd23f0` (היה הפרודקשן בזמן המעבר), קיים על `origin/master`.
- **Vercel:** Deployments → **Instant Rollback** אל `dpl_48TV4UV2rz9BfYp68mXX5coxXwqF`.
- **DNS (לבטל את החיתוך):** ב‑internic החזר `www` ל‑`CNAME shops.myshopify.com.` והסר את ה‑`A` מהשורש. ~5 דק'.
- **אימייל נפגע?** סימן שנגעו ב‑MX/SPF/DKIM — החזר מהצילום שנשמר לפני המעבר.

---

## 5. הפלואו לשינויים עתידיים (מעודכן לדומיין החי)

האתר ב‑Vercel מתפרסם אוטומטית מ‑`master`. **עובדים ישירות מול git** — Vercel רק מריץ את מה שדוחפים. אין כניסה ל‑Vercel לעבודה שוטפת.

1. עבוד על feature branch (`claude/...`).
2. `npm run verify` — lint + build (שער האיכות; חייב לעבור).
3. ff‑merge ל‑master ודחיפה:
   ```bash
   git checkout master
   git merge --ff-only origin/<feature-branch>
   git push origin master
   git checkout <feature-branch>
   ```
4. Vercel בונה אוטומטית מ‑`master` (~90 שׁנ') → **חי על `https://toptik.co.il`**.
5. **גיבוי גרסה:** `git tag -a "backup/<YYYY-MM-DD>-<desc>" -m "..."`.
6. **rollback מהיר:** Vercel → Deployments → Instant Rollback.

> אסור לדחוף ל‑`master` קוד שלא עבר feature → verify. תמיד: feature → ff‑merge → push master.
