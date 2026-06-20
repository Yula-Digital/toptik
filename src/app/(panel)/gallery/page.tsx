import Link from "next/link";
import { requirePanelUser } from "@/lib/admin/supabase-server";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { GalleryEditor } from "@/components/admin/GalleryEditor";
import { ArrowBackIcon } from "@/components/admin/icons";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
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
          <p className="admin-eyebrow">גלריית דף הנחיתה</p>
          <h1 className="admin-title">עריכת הקרוסלה</h1>
          <p className="admin-subtitle">הוסיפו, ערכו וייבאו מוצרים לקרוסלה המוצגת בדף הבית.</p>
        </div>

        <GalleryEditor />
      </main>
    </>
  );
}
