import Link from "next/link";
import { LogoutButton } from "@/components/admin/LogoutButton";

/** Sticky top bar for authenticated panel pages. */
export function AdminTopBar({ email }: { email: string | null }) {
  return (
    <header className="admin-topbar">
      <Link href="/dashboard" className="admin-brand" aria-label="TOPTIK Admin — לדף הבית">
        <span className="admin-brand-mark">T</span>
        <span className="admin-brand-text">
          <b>TOPTIK</b>
          <span>פאנל ניהול</span>
        </span>
      </Link>
      <div className="admin-topbar-spacer" />
      <div className="admin-user">
        {email && (
          <span className="admin-user-email" title={email}>
            {email}
          </span>
        )}
        <LogoutButton />
      </div>
    </header>
  );
}
