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

export function SettingsUsersClient({ currentEmail }: { currentEmail: string | null }) {
  const [users, setUsers] = useState<PanelUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

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

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setInviting(true);
    try {
      const res = await fetch("/api/panel/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "ההזמנה נכשלה");
      setInviteEmail("");
      setFeedback({ tone: "success", message: "ההזמנה נשלחה. המנהל החדש יקבל קישור להגדרת סיסמה." });
      await load();
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "שגיאה" });
    } finally {
      setInviting(false);
    }
  }

  async function resetUser(email: string | null) {
    if (!email) return;
    setFeedback(null);
    setPendingId(email);
    try {
      const res = await fetch("/api/panel/users/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "שליחת האיפוס נכשלה");
      setFeedback({ tone: "success", message: `קישור לאיפוס סיסמה נשלח אל ${email}.` });
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
          ניתן להגדיר עד {MAX_ADMIN_USERS} מנהלים. כל מנהל מתחבר עם המייל והסיסמה שלו, ויכול לאפס סיסמה בעצמו.
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
                      ? "הזמנה ממתינה — טרם הוגדרה סיסמה"
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
                    title="שליחת קישור איפוס סיסמה"
                    aria-label={`שליחת איפוס סיסמה ל-${user.email}`}
                    disabled={pendingId === user.email || !user.email}
                    onClick={() => resetUser(user.email)}
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

      <form onSubmit={invite}>
        <label className="admin-label" htmlFor="invite-email">
          הזמנת מנהל חדש
        </label>
        <div className="admin-add-row">
          <input
            id="invite-email"
            className="admin-input"
            type="email"
            dir="ltr"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="name@toptik.co.il"
            disabled={atCapacity || inviting}
            required
          />
          <button type="submit" className="admin-btn admin-btn--primary" disabled={atCapacity || inviting}>
            {inviting ? <span className="admin-spin" /> : <PlusIcon />}
            הזמנה
          </button>
        </div>
        <p className="admin-hint" style={{ marginTop: 8 }}>
          {atCapacity
            ? `הגעתם למספר המנהלים המרבי (${MAX_ADMIN_USERS}). הסירו מנהל כדי להזמין אחר.`
            : "המוזמן יקבל מייל עם קישור להגדרת סיסמה והתחברות."}
        </p>
      </form>
    </div>
  );
}
