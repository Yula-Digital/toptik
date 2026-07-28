"use client";

import { useState } from "react";
import { createPanelBrowserClient } from "@/lib/admin/supabase-browser";

export function SetupClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError("הסיסמה חייבת לפחות 10 תווים.");
      return;
    }
    if (password !== confirm) {
      setError("הסיסמאות אינן תואמות.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/panel/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, token: token.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "ההקמה נכשלה.");
        setBusy(false);
        return;
      }

      // Sign the new owner straight in, then land on the dashboard.
      const supabase = createPanelBrowserClient();
      await supabase.auth.signInWithPassword({ email: email.trim(), password });
      window.location.assign("/dashboard");
    } catch {
      setError("שגיאה בהקמה. נסו שוב.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && (
        <div className="admin-feedback admin-feedback--error" role="alert">
          {error}
        </div>
      )}

      <div className="admin-field">
        <label className="admin-label" htmlFor="setup-email">
          אימייל המנהל הראשי
        </label>
        <input
          id="setup-email"
          className="admin-input"
          type="email"
          dir="ltr"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="owner@toptik.co.il"
          required
        />
      </div>

      <div className="admin-grid-2">
        <div className="admin-field">
          <label className="admin-label" htmlFor="setup-password">
            סיסמה
          </label>
          <input
            id="setup-password"
            className="admin-input"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="לפחות 10 תווים"
            required
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="setup-confirm">
            אימות סיסמה
          </label>
          <input
            id="setup-confirm"
            className="admin-input"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="setup-token">
          טוקן הקמה
        </label>
        <input
          id="setup-token"
          className="admin-input"
          type="password"
          dir="ltr"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ADMIN_PANEL_TOKEN"
          required
        />
        <span className="admin-hint">
          זהו ערך משתנה הסביבה <code>ADMIN_PANEL_TOKEN</code> שמוגדר ב‑Vercel. נדרש פעם אחת בלבד.
        </span>
      </div>

      <button type="submit" className="admin-btn admin-btn--primary admin-btn--block" disabled={busy}>
        {busy && <span className="admin-spin" />}
        יצירת מנהל וכניסה
      </button>
    </form>
  );
}
