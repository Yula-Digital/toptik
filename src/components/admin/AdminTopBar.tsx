import Link from "next/link";
import Image from "next/image";
import { LogoutButton } from "@/components/admin/LogoutButton";

/** Sticky top bar for authenticated panel pages. */
export function AdminTopBar({ email }: { email: string | null }) {
  return (
    <header className="admin-topbar">
      <Link href="/dashboard" className="admin-brand" aria-label="TOPTIK — פאנל ניהול">
        <Image
          src="/toptiklogo.png"
          alt="TOPTIK"
          width={380}
          height={150}
          className="admin-brand-logo"
          priority
        />
        <span className="admin-brand-tag">פאנל ניהול</span>
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
