import Image from "next/image";
import { redirect } from "next/navigation";
import { getPanelUser } from "@/lib/admin/supabase-server";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { countAdminUsers } from "@/lib/admin/users";
import { LoginClient } from "@/components/admin/LoginClient";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getPanelUser();
  if (user) redirect("/dashboard");

  // First run (no accounts yet) → send the visitor to one-time setup.
  // NOTE: compute the flag inside try/catch, but call redirect() OUTSIDE it —
  // redirect() signals via a thrown error that a catch would otherwise swallow.
  let needsSetup = false;
  if (hasSupabaseAdminEnv()) {
    try {
      needsSetup = (await countAdminUsers()) === 0;
    } catch {
      needsSetup = false;
    }
  }
  if (needsSetup) redirect("/setup");

  const { error } = await searchParams;
  const initialError = error === "link" ? "הקישור פג תוקף או שאינו תקין. נסו שוב." : undefined;

  return (
    <main className="admin-main admin-main--narrow">
      <div className="admin-auth-card">
        <Image src="/toptiklogo.png" alt="TOPTIK" width={380} height={150} className="admin-auth-logo-img" priority />
        <h1 className="admin-auth-title">פאנל הניהול של TOPTIK</h1>
        <p className="admin-auth-sub">התחברו עם פרטי המנהל שלכם כדי להמשיך.</p>
        <LoginClient initialError={initialError} />
      </div>
    </main>
  );
}
