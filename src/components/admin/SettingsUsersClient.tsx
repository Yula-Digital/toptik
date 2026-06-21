"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_ADMIN_USERS } from "@/lib/admin/config";
import { KeyIcon, TrashIcon, PlusIcon } from "@/components/admin/icons";

type PanelUser = {
  id: string;
  email: string | null;
  role: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  invitePending: boolean;
};

type Feedback = { tone: "success" | "error" | "info"; message: string } | null;

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "—";
  }
}

// A strong random password (no ambiguous chars). Created client-side via Web
// Crypto so the owner can hand it to the new admin — no email is involved.
function generatePassword(len = 14): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

export function SettingsUsersClient({ currentEmail }: { currentEmail: string | null }) {
  const [users, setUsers] = useState<PanelUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/panel/users");
      const data = (await res.json().catch(() => null)) as { users?: PanelUser[]; error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "טעינת המשתמשים נכשלה");
      setUsers(data?.users ?? []);
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "שגיאה" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAdmin(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const email = newEmail.trim();
    if (newPassword.length < 10) {
      setFeedback({ tone: "error", message: "הסיסמה חייבת להכיל לפחות 10 תווים." });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/panel/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: newPassword }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "יצירת המנהל נכשלה");
      setFeedback({
        tone: "success",
        message: `המנהל נוצר. מסרו לו את הפרטים (אין מייל אוטומטי) — אימייל: ${email} · סיסמה: ${newPassword}`,
      });
      setNewEmail("");
      setNewPassword("");
      await load();
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "שגיאה" });
    } finally {
      setCreating(false);
    }
  }

  async function resetUser(user: PanelUser) {
    if (!window.confirm(`לאפס את הסיסמה של ${user.email}? תיווצר סיסמה חדשה שתצטרכו למסור לו.`)) return;
    setFeedback(null);
    setPendingId(user.id);
    try {
      const password = generatePassword();
      const res = await fetch("/api/panel/users/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, password }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "איפוס הסיסמה נכשל");
      setFeedback({ tone: "success", message: `סיסמה חדשה ל-${user.email}: ${password} — מסרו לו אותה.` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "שגיאה" });
    } finally {
      setPendingId(null);
    }
  }

  async function removeUser(user: PanelUser) {
    if (!window.confirm(`למחוק את המנהל ${user.email}?`)) return;
    setFeedback(null);
    setPendingId(user.id);
    try {
      const res = await fetch(`/api/panel/users?id=${encodeURIComponent(user.id)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "המחיקה נכשלה");
      setFeedback({ tone: "success", message: "המנהל הוסר." });
      await load();
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "שגיאה" });
    } finally {
      setPendingId(null);
    }
  }

  const atCapacity = users.length >= MAX_ADMIN_USERS;

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <h2 className="admin-card-title">משתמשי מנהל</h2>
        <p className="admin-card-desc">
          ניתן להגדיר עד {MAX_ADMIN_USERS} מנהלים. כל מנהל מתחבר עם המייל והסיסמה שלו; הבעלים יוצר מנהלים ומאפס סיסמאות
          ישירות (ללא מייל).
        </p>
      </div>

      {feedback && (
        <div className={`admin-feedback admin-feedback--${feedback.tone}`} role="status">
          {feedback.message}
        </div>
      )}

      {loading ? (
        <div className="admin-empty">טוען משתמשים…</div>
      ) : (
        <div className="admin-users">
          {users.map((user) => {
            const isSelf = Boolean(currentEmail && user.email && currentEmail.toLowerCase() === user.email.toLowerCase());
            const initial = (user.email ?? "?").charAt(0).toUpperCase();
            const isOwner = user.role === "owner";
            return (
              <div key={user.id} className="admin-user-card">
                <span className="admin-user-avatar">{initial}</span>
                <div className="admin-user-main">
                  <div className="admin-user-email">
                    {user.email}
                    {isSelf && <span style={{ color: "var(--p-ink-faint)" }}> (אתם)</span>}
                  </div>
                  <div className="admin-user-meta">
                    {user.invitePending
                      ? "טרם התחבר/ה"
                      : `כניסה אחרונה: ${formatDate(user.lastSignInAt)}`}
                  </div>
                </div>
                <span className={`admin-role-badge ${isOwner ? "admin-role-badge--owner" : ""}`}>
                  {isOwner ? "ראשי" : "מנהל"}
                </span>
                <div className="admin-user-actions">
                  <button
                    type="button"
                    className="admin-icon-btn"
                    title="איפוס סיסמה (הגדרת סיסמה חדשה)"
                    aria-label={`איפוס סיסמה ל-${user.email}`}
                    disabled={pendingId === user.id || !user.email}
                    onClick={() => resetUser(user)}
                  >
                    <KeyIcon />
                  </button>
                  <button
                    type="button"
                    className="admin-icon-btn admin-icon-btn--danger"
                    title={isSelf ? "לא ניתן למחוק את עצמכם" : "מחיקת מנהל"}
                    aria-label={`מחיקת ${user.email}`}
                    disabled={pendingId === user.id || isSelf || users.length <= 1}
                    onClick={() => removeUser(user)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <hr className="admin-divider" />

      <form onSubmit={createAdmin}>
        <label className="admin-label" htmlFor="new-email">
          הוספת מנהל חדש
        </label>
        <div className="admin-add-row">
          <input
            id="new-email"
            className="admin-input"
            type="email"
            dir="ltr"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="name@toptik.co.il"
            disabled={atCapacity || creating}
            required
          />
        </div>
        <div className="admin-add-row" style={{ marginTop: 8 }}>
          <input
            id="new-password"
            className="admin-input"
            type="text"
            dir="ltr"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="סיסמה (לפחות 10 תווים)"
            autoComplete="new-password"
            disabled={atCapacity || creating}
            required
          />
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => setNewPassword(generatePassword())}
            disabled={atCapacity || creating}
          >
            צור סיסמה
          </button>
        </div>
        <div className="admin-add-row" style={{ marginTop: 8 }}>
          <button type="submit" className="admin-btn admin-btn--primary" disabled={atCapacity || creating}>
            {creating ? <span className="admin-spin" /> : <PlusIcon />}
            יצירת מנהל
          </button>
        </div>
        <p className="admin-hint" style={{ marginTop: 8 }}>
          {atCapacity
            ? `הגעתם למספר המנהלים המרבי (${MAX_ADMIN_USERS}). הסירו מנהל כדי להוסיף אחר.`
            : "המנהל ייווצר מיד עם הסיסמה. מסרו לו את האימייל והסיסמה — אין מייל אוטומטי. הוא יוכל לשנות סיסמה אחרי הכניסה."}
        </p>
      </form>
    </div>
  );
}
