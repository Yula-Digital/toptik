import Image from "next/image";
import { getPanelUser } from "@/lib/admin/supabase-server";
import { ResetClient } from "@/components/admin/ResetClient";

export const dynamic = "force-dynamic";

export default async function ResetPage() {
  // A recovery link establishes a session (via /auth/callback) before landing
  // here, so a present user means "set a new password"; otherwise "request one".
  const user = await getPanelUser();
  const hasSession = Boolean(user);

  return (
    <main className="admin-main admin-main--narrow">
      <div className="admin-auth-card">
        <Image src="/toptiklogo.png" alt="TOPTIK" width={380} height={150} className="admin-auth-logo-img" priority />
        <h1 className="admin-auth-title">{hasSession ? "בחירת סיסמה חדשה" : "איפוס סיסמה"}</h1>
        <p className="admin-auth-sub">
          {hasSession
            ? "הזינו סיסמה חדשה לחשבון המנהל שלכם."
            : "הזינו את כתובת המייל שלכם ונשלח אליכם קישור לאיפוס הסיסמה."}
        </p>
        <ResetClient hasSession={hasSession} />
      </div>
    </main>
  );
}
