import Link from "next/link";
import { requirePanelUser } from "@/lib/admin/supabase-server";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { SettingsUsersClient } from "@/components/admin/SettingsUsersClient";
import { ArrowBackIcon } from "@/components/admin/icons";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requirePanelUser();

  return (
    <>
      <AdminTopBar email={user.email ?? null} />
      <main className="admin-main">
        <Link href="/dashboard" className="admin-back">
          <ArrowBackIcon />
          חזרה ללוח הבקרה
        </Link>

        <div className="admin-page-head">
          <p className="admin-eyebrow">הגדרות אדמין</p>
          <h1 className="admin-title">ניהול מנהלים והגדרות</h1>
          <p className="admin-subtitle">נהלו את חשבונות המנהלים והגדרות המערכת.</p>
        </div>

        <SettingsUsersClient currentEmail={user.email ?? null} />
      </main>
    </>
  );
}
