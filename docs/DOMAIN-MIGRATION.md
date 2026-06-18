# העברת דף הנחיתה לדומיין toptik.co.il — Runbook

> מסמך תפעולי לחיתוך הדומיין מ‑`*.vercel.app` אל `toptik.co.il`, כולל גיבוי, אימות, rollback ותהליך לשינויים עתידיים.
> נכתב: 2026-06-18. נכתב כחלק מתהליך מסודר — לא לאלתר. כל ערך טכני מובא בבלוק קוד להעתקה ישירה.

---

## 0. מצב נוכחי (snapshot)

| פריט | ערך |
|---|---|
| פרויקט Vercel | `toptik` |
| Project ID | `prj_7LROyMek3LBhb16a9e4A4EyJNhJy` |
| Team | `rordan-ais-projects` (`team_OOyctgp7Iroyd2ONA9sy9XJL`) |
| Framework | Next.js (Node 24) |
| Production deployment | `dpl_48TV4UV2rz9BfYp68mXX5coxXwqF` (READY) |
| Production commit | `fdd23f0` (branch `master`) |
| דומיינים מחוברים כיום | `toptik-iota.vercel.app`, `toptik-rordan-ais-projects.vercel.app`, `toptik-git-master-...` |
| דומיין יעד | `toptik.co.il` (שורש ראשי) + `www.toptik.co.il` (redirect לשורש) |
| רשם/ניהול DNS | internic — `https://portal.internic.co.il` |
| שיטת חיתוך | רשומות A/CNAME (ה‑DNS נשאר ב‑internic; **לא** מעבירים nameservers) |

## נקודת גיבוי / rollback anchor

- **Git tag:** `backup/pre-domain-migration-2026-06-18` → מצביע על `fdd23f0`.
- **Vercel rollback:** Instant Rollback אל deployment `dpl_48TV4UV2rz9BfYp68mXX5coxXwqF`.
- חיבור הדומיין ב‑Vercel וניתוקו הם פעולות מיידיות והפיכות; שינוי ה‑DNS הפיך תוך דקות אם משאירים TTL נמוך (ראה שלב 0).

---

## 0.5 גיבוי DNS — לפני שנוגעים (חובה)

לפני כל שינוי ב‑internic, גבה את מצב האזור (zone) הנוכחי של `toptik.co.il`:

1. היכנס ל‑`https://portal.internic.co.il` → ניהול הדומיין `toptik.co.il` → אזור ה‑DNS.
2. **צלם מסך / ייצא את כל הרשומות הקיימות:** `A`, `AAAA`, `CNAME`, `MX`, `TXT` (כולל SPF/DKIM/DMARC), `NS`, `SRV`. שמור את הצילום בצד.
3. שים לב במיוחד ל‑**MX ול‑TXT של דוא"ל** — בשיטת A/CNAME אנחנו **לא נוגעים בהם בכלל**. הגיבוי הזה הוא רשת הביטחון ל‑rollback.
4. אם לשורש (`@`) כבר יש רשומת `A` קיימת (אתר ישן / דף חניה) — הורד את ה‑TTL שלה ל‑`300` שניות ושמור, **לפני** יום החיתוך, כדי שהמעבר יהיה מהיר והפיך.

---

## 1. צד Vercel — חיבור הדומיין (מבצע: משתמש מחובר / Claude‑for‑Chrome)

> ב‑MCP של Vercel **אין** כלי להוספת דומיין — לכן זה נעשה בדשבורד. הערכים המדויקים שמסך "Add Domain" מציג הם **המקור הסמכותי**; אם הם שונים ממה שכאן — לך לפי המסך.

1. Vercel → Team `rordan-ais-projects` → Project **toptik** → **Settings → Domains**.
2. **Add Domain** → הקלד `toptik.co.il` → Add.
3. הוסף גם `www.toptik.co.il`.
4. הגדר את `toptik.co.il` כ‑**Primary**, ואת `www.toptik.co.il` כ‑**Redirect to `toptik.co.il`** (308).
5. Vercel יציג עכשיו את הרשומות שצריך להגדיר ב‑DNS. רשום מה שהוא מציג (זה מה שמכניסים בשלב 2). בדרך כלל:
   - לשורש: רשומת `A` לכתובת ה‑IP של Vercel.
   - ל‑`www`: רשומת `CNAME` ל‑`cname.vercel-dns.com`.
   - אם מופיע **TXT אימות** (`_vercel`) — רשום גם אותו.

---

## 2. צד internic — רשומות ה‑DNS (מבצע: משתמש מחובר / Claude‑for‑Chrome)

ב‑`portal.internic.co.il` → אזור ה‑DNS של `toptik.co.il`, הוסף/ערוך **רק** את הרשומות הבאות. **אל תיגע ב‑MX, SPF/DKIM/DMARC או רשומות קיימות אחרות.**

```
# שורש (apex) — toptik.co.il
Type:  A
Host:  @            (או ריק / "toptik.co.il" לפי הטופס ב-internic)
Value: 216.198.79.1     ← השתמש בערך שמסך "Add Domain" של Vercel מציג
TTL:   300

# www — מפנה לשורש דרך Vercel
Type:  CNAME
Host:  www
Value: cname.vercel-dns.com.
TTL:   300

# (רק אם Vercel ביקש אימות בעלות)
Type:  TXT
Host:  _vercel
Value: <הערך ש-Vercel הציג>
TTL:   300
```

הערות:
- **שורש לא יכול להיות CNAME** (חוק DNS) — לכן השורש הוא `A`. לכן גם בחרנו "שורש ראשי".
- אם internic לא מאפשר `CNAME` על `www` מסיבה כלשהי — אפשר חלופית `A` עם אותו IP של השורש (פחות אידאלי, אך עובד).
- TTL `300` (5 דק') = חיתוך והחזרה מהירים.

---

## 3. אימות (מבצע: Claude Code מצד Vercel + משתמש מצד DNS)

1. **מצד Vercel (אני):** דרך ה‑API לבדוק שהדומיין מופיע ומאומת (`get_project` → `toptik.co.il` ב‑`domains[]`, מצב Valid Configuration).
2. **התפשטות DNS (אתה):**
   ```bash
   dig toptik.co.il +short          # מצופה: 216.198.79.1
   dig www.toptik.co.il +short      # מצופה: cname.vercel-dns.com.
   ```
   או דרך `https://www.whatsmydns.net` למספר מיקומים.
3. **HTTPS:** Vercel מנפיק תעודת SSL אוטומטית תוך דקות מרגע שה‑DNS תקין. ודא ש‑`https://toptik.co.il` נטען וש‑`https://www.toptik.co.il` עושה redirect לשורש.
4. **בדיקה ויזואלית:** פתח את `https://toptik.co.il` ואת `/carousel` ובדוק שהכול נטען (תמונות, קרוסלה).

---

## 4. Rollback (אם משהו משתבש)

| תקלה | פעולה |
|---|---|
| האתר לא נטען בדומיין | ודא שרשומת ה‑`A`/`CNAME` תואמת בדיוק למה ש‑Vercel מציג; המתן להתפשטות (TTL 300). |
| צריך לבטל לגמרי | מחק את רשומות ה‑`A`/`CNAME`/`TXT` שהוספנו ב‑internic והחזר מהצילום (שלב 0.5). תוך ~5 דק' חוזרים למצב הקודם. |
| בעיה באתר עצמו (קוד) | Vercel → Deployments → **Instant Rollback** אל `dpl_48TV4UV2rz9BfYp68mXX5coxXwqF`, או בנה מחדש מ‑tag `backup/pre-domain-migration-2026-06-18`. |
| דוא"ל הפסיק לעבוד | סימן שנגעו ב‑MX — החזר את רשומות ה‑MX מהצילום. (בשיטת A/CNAME זה לא אמור לקרות.) |

---

## 5. תהליך לשינויים עתידיים (commit + build + גיבוי)

מאחר שהאתר מתארח ב‑Vercel ומתפרסם אוטומטית מ‑`master`, זרימת העבודה לכל שינוי:

1. עבוד על feature branch (`claude/...`).
2. `npm run verify` — lint + build, חייב לעבור (שער האיכות; משקף את CI).
3. ff‑merge ל‑master ודחיפה:
   ```bash
   git checkout master
   git merge --ff-only origin/<feature-branch>
   git push origin master
   git checkout <feature-branch>
   ```
4. Vercel בונה אוטומטית מ‑`master` (~90 שׁנ') ומפרסם ל‑`https://toptik.co.il`.
5. **גיבוי גרסה:** תייג כל שחרור משמעותי ודחוף את ה‑tags:
   ```bash
   git tag -a "backup/<YYYY-MM-DD>-<desc>" -m "<תיאור>"
   git push origin --tags
   ```
6. **rollback מהיר:** Vercel → Deployments → Instant Rollback ל‑deployment קודם, או build מחדש מ‑tag.
7. גיבוי bundle מלא (Windows/PowerShell בלבד): `npm run backup:bundle`.

> אסור לדחוף ל‑`master` קוד שלא עבר קודם feature → verify. תמיד: feature → ff‑merge → push master.
