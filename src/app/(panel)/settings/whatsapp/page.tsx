import Link from "next/link";
import { requirePanelUser } from "@/lib/admin/supabase-server";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { WhatsappClient } from "@/components/admin/WhatsappClient";
import { ArrowBackIcon } from "@/components/admin/icons";

export const dynamic = "force-dynamic";

export default async function WhatsappSettingsPage() {
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
          <p className="admin-eyebrow">סוכן וואטסאפ AI</p>
          <h1 className="admin-title">הגדרת סוכן הוואטסאפ</h1>
          <p className="admin-subtitle">הפעילו או השביתו את הסוכן, והגדירו את פרטי החיבור ואופי המענה.</p>
        </div>

        <WhatsappClient />
      </main>
    </>
  );
}
