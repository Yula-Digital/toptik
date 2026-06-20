"use client";

import { useState } from "react";
import { createPanelBrowserClient } from "@/lib/admin/supabase-browser";
import { LogoutIcon } from "@/components/admin/icons";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await createPanelBrowserClient().auth.signOut();
    } catch {
      // ignore — we redirect regardless
    }
    window.location.assign("/login");
  }

  return (
    <button type="button" className="admin-btn admin-btn--ghost" onClick={signOut} disabled={busy}>
      {busy ? <span className="admin-spin" /> : <LogoutIcon />}
      התנתקות
    </button>
  );
}
