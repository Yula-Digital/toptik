import { redirect } from "next/navigation";
import { getPanelUser } from "@/lib/admin/supabase-server";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { countAdminUsers } from "@/lib/admin/users";
import { SetupClient } from "@/components/admin/SetupClient";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const user = await getPanelUser();
  if (user) redirect("/dashboard");

  const envOk = hasSupabaseAdminEnv();
  let alreadySetUp = false;
  if (envOk) {
    try {
      alreadySetUp = (await countAdminUsers()) > 0;
    } catch {
      alreadySetUp = false;
    }
  }
  if (alreadySetUp) redirect("/login");

  return (
    <main className="admin-main admin-main--narrow">
      <div className="admin-auth-card">
        <div className="admin-auth-logo">T</div>
        <h1 className="admin-auth-title">הקמת מנהל ראשי</h1>
        <p className="admin-auth-sub">
          ברוכים הבאים ל‑TOPTIK Admin. צרו את חשבון המנהל הראשון. לאחר מכן תוכלו להזמין עד שני מנהלים נוספים מתוך הפאנל.
        </p>
        {envOk ? (
          <SetupClient />
        ) : (
          <div className="admin-feedback admin-feedback--info" role="status">
            חיבור ל‑Supabase אינו מוגדר בסביבה זו. הגדירו את משתני הסביבה של Supabase והטוקן כדי להפעיל את ההקמה.
          </div>
        )}
      </div>
    </main>
  );
}
