"use client";

import { useState } from "react";
import Link from "next/link";
import { createPanelBrowserClient } from "@/lib/admin/supabase-browser";

export function ResetClient({ hasSession }: { hasSession: boolean }) {
  if (hasSession) return <SetPasswordForm />;
  return <RequestResetForm />;
}

function RequestResetForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = createPanelBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (resetError) {
        setError("לא הצלחנו לשלוח את הקישור. בדקו את כתובת המייל ונסו שוב.");
        setBusy(false);
        return;
      }
      setSent(true);
    } catch {
      setError("שגיאה בשליחת הקישור. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="admin-feedback admin-feedback--success" role="status">
        אם הכתובת רשומה כמנהל, נשלח אליה קישור לאיפוס סיסמה. בדקו את תיבת הדואר (וגם ספאם).
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && (
        <div className="admin-feedback admin-feedback--error" role="alert">
          {error}
        </div>
      )}
      <div className="admin-field">
        <label className="admin-label" htmlFor="reset-email">
          כתובת המייל שלכם
        </label>
        <input
          id="reset-email"
          className="admin-input"
          type="email"
          dir="ltr"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@toptik.co.il"
          required
        />
      </div>
      <button type="submit" className="admin-btn admin-btn--primary admin-btn--block" disabled={busy}>
        {busy && <span className="admin-spin" />}
        שליחת קישור איפוס
      </button>
      <div style={{ textAlign: "center", marginTop: 18 }}>
        <Link href="/login" className="admin-link">
          חזרה לכניסה
        </Link>
      </div>
    </form>
  );
}

function SetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
      const supabase = createPanelBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("עדכון הסיסמה נכשל. ייתכן שהקישור פג תוקף — בקשו קישור חדש.");
        setBusy(false);
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      setError("שגיאה בעדכון הסיסמה. נסו שוב.");
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
        <label className="admin-label" htmlFor="new-password">
          סיסמה חדשה
        </label>
        <input
          id="new-password"
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
        <label className="admin-label" htmlFor="confirm-password">
          אימות סיסמה
        </label>
        <input
          id="confirm-password"
          className="admin-input"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      <button type="submit" className="admin-btn admin-btn--primary admin-btn--block" disabled={busy}>
        {busy && <span className="admin-spin" />}
        שמירת סיסמה חדשה
      </button>
    </form>
  );
}
