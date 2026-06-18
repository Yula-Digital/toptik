# העברת דף הנחיתה לדומיין toptik.co.il — Runbook

> מסמך תפעולי לחיתוך הדומיין מ‑Shopify/`*.vercel.app` אל דף הנחיתה ב‑Vercel, כולל גיבוי, אימות, rollback ותהליך לשינויים עתידיים.
> נכתב: 2026-06-18. **ערכים מאומתים** מול מסכי internic + Vercel בפועל. כל ערך טכני בבלוק קוד להעתקה ישירה.

---

## 0. מצב נוכחי (snapshot מאומת)

| פריט | ערך |
|---|---|
| פרויקט Vercel | `toptik` · `prj_7LROyMek3LBhb16a9e4A4EyJNhJy` |
| Team | `rordan-ais-projects` · `team_OOyctgp7Iroyd2ONA9sy9XJL` |
| Production commit | `fdd23f0` (branch `master`) |
| Production deployment | `dpl_48TV4UV2rz9BfYp68mXX5coxXwqF` (READY) — יעד ה‑rollback |
| דומיין יעד | `toptik.co.il` (שורש, ראשי) + `www.toptik.co.il` (redirect לשורש) |
| ניהול DNS | internic / sitesdepot — `https://portal.internic.co.il` (zone 7144) |
| Nameservers (לא נוגעים) | `ns1.sitesdepot.com` / `ns2.sitesdepot.com` |
| שיטה | רשומות A/CNAME (אין שינוי nameservers) |
| **החלטה** | **דף הנחיתה מחליף את חנות Shopify על הדומיין.** החנות נשארת חיה ב‑`*.myshopify.com`. |

**שירותים חיים על הדומיין שאסור לפגוע בהם:**
- **אימייל Google Workspace** — `MX` → ASPMX.L.GOOGLE.COM (+ALT), ו‑`TXT` SPF (`v=spf1 ... include:spf.google.com ~all`).
- **אימות דוא"ל Shopify** — `lul._domainkey`, `lul2._domainkey`, `lul3._domainkey`, `mailerlul` (CNAME ל‑myshopify), ו‑`dmarc` TXT.
- מאחר שהאימייל וה‑Shopify כבר עובדים מתוך ה‑zone הזה, ההאצלה (delegation) כבר מצביעה ל‑sitesdepot → **עריכות כאן סמכותיות; אין צורך בשינוי nameservers.**

## נקודת גיבוי / rollback anchor

- **קוד:** commit `fdd23f0` קיים על `origin/master` (עמיד). tag מקומי `backup/pre-domain-migration-2026-06-18` (לא נדחף — ה‑proxy חוסם tags; לא נדרש).
- **Vercel:** Instant Rollback אל `dpl_48TV4UV2rz9BfYp68mXX5coxXwqF`.
- **DNS:** צילום מסך של ה‑zone לפני השינוי = בסיס ההחזרה.

---

## 1. צד Vercel — חיבור + כיוון

הדומיין כבר נוסף (מצב Invalid Configuration עד שה‑DNS יתוקן). הגדרות נדרשות ב‑Settings → Domains:

1. `toptik.co.il` = **Primary**.
2. `www.toptik.co.il` = **Redirect to `toptik.co.il`** (308).
   - ⚠️ כברירת מחדל זה נוסף הפוך (`toptik.co.il` → 308 → `www`) — צריך **להפוך** לכיוון הנ"ל.
3. ערכי ה‑DNS שמסך Vercel מציג הם הסמכותיים. נכון להיום:
   - שורש: `A` → `216.150.1.1` (חדש; הישנים `76.76.21.21` / `cname.vercel-dns.com` עדיין עובדים).

---

## 2. צד internic — בדיוק 2 רשומות אתר

ב‑zone של `toptik.co.il`. **קודם צלם את כל הרשומות** (גיבוי). ואז:

```
① www — מסיר את Shopify (ערוך רשומה קיימת):
     www.toptik.co.il   CNAME   shops.myshopify.com.    ← הערך הישן
   שנה ל:
     www.toptik.co.il   CNAME   cname.vercel-dns.com.   TTL 300

② שורש (apex):
   • אם קיימת A על @ / toptik.co.il → ערוך ל:  216.150.1.1
   • אם אין → הוסף:   @   A   216.150.1.1   TTL 300
   (לא מתנגש עם MX/SPF על השורש — האימייל לא נפגע)

③ TXT _vercel — רק אם Vercel ביקש אימות בעלות (לא הופיע במסך → כנראה לא נדרש)
```

🛑 **אל תיגע:** `NS` · `lul._domainkey` · `lul2._domainkey` · `lul3._domainkey` · `mailerlul` · `ftp` · `dmarc` (TXT) · `TXT` SPF על השורש · `MX` של Google.

> ל‑www הישן TTL 3600 → התפשטות מלאה עד ~שעה. חיפושים לא‑מטמון עוברים מיד.

---

## 3. אימות

1. **Vercel (אני, דרך API):** הדומיין עובר ל‑Valid Configuration; `get_project` יציג את `toptik.co.il` ב‑`domains[]`.
2. **DNS (אתה):**
   ```bash
   dig toptik.co.il +short        # 216.150.1.1
   dig www.toptik.co.il +short    # cname.vercel-dns.com.
   ```
   או `https://www.whatsmydns.net`.
3. **HTTPS:** SSL מונפק אוטומטית תוך דקות. ודא ש‑`https://toptik.co.il` נטען, וש‑`https://www.toptik.co.il` עושה redirect לשורש.
4. **ויזואלי:** `https://toptik.co.il` + `/carousel` — תמונות וקרוסלה נטענות.

---

## 4. Rollback

| תקלה | פעולה |
|---|---|
| לבטל את החיתוך לגמרי | החזר `www` ל‑`CNAME shops.myshopify.com.` והסר/החזר את ה‑`A` של השורש מהצילום. ~5 דק' (TTL 300). |
| בעיה בקוד האתר | Vercel → Deployments → **Instant Rollback** ל‑`dpl_48TV4UV2rz9BfYp68mXX5coxXwqF`, או build מ‑tag הגיבוי. |
| אימייל הפסיק | סימן שנגעו ב‑MX/SPF/DKIM — החזר מהצילום. (בשיטה הזו לא אמור לקרות.) |

---

## 5. תהליך לשינויים עתידיים (commit + build + גיבוי)

האתר ב‑Vercel מתפרסם אוטומטית מ‑`master`. **אתה עובד ישירות מול git** — Vercel רק מריץ את מה שאתה דוחף. אין כניסה ל‑Vercel לעבודה שוטפת.

1. עבוד על feature branch (`claude/...`).
2. `npm run verify` — lint + build (שער האיכות; חייב לעבור).
3. ff‑merge ל‑master ודחיפה:
   ```bash
   git checkout master
   git merge --ff-only origin/<feature-branch>
   git push origin master
   git checkout <feature-branch>
   ```
4. Vercel בונה אוטומטית מ‑`master` (~90 שׁנ') → `https://toptik.co.il`.
5. **גיבוי גרסה:** `git tag -a "backup/<YYYY-MM-DD>-<desc>" -m "..."` (ה‑tags לא נדחפים דרך ה‑proxy של סביבת הענן; דחוף מקומית/דרך GitHub אם צריך עותק מרוחק).
6. **rollback מהיר:** Vercel → Deployments → Instant Rollback.

> אסור לדחוף ל‑`master` קוד שלא עבר feature → verify. תמיד: feature → ff‑merge → push master.
