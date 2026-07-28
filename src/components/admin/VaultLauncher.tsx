"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  LockIcon,
  KeyIcon,
  EyeIcon,
  EyeOffIcon,
  CopyIcon,
  EditIcon,
  TrashIcon,
  PlusIcon,
  CloseIcon,
  CheckIcon,
  ExternalIcon,
} from "@/components/admin/icons";

type VaultEntry = {
  id: string;
  label: string;
  username: string;
  url: string | null;
  notes: string | null;
  secret: string;
  updatedAt: string;
};

type Phase = "idle" | "code" | "open";
type FormState = { id: string | null; label: string; username: string; secret: string; url: string; notes: string };
const EMPTY_FORM: FormState = { id: null, label: "", username: "", secret: "", url: "", notes: "" };

/**
 * "סיסמאות" — opens an encrypted password vault, but only after a fresh email
 * OTP step-up. Clicking the tile emails a 6-digit code; entering it unlocks the
 * vault for a short window (add / edit / delete / reveal / copy).
 */
export function VaultLauncher() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [code, setCode] = useState("");
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  const close = useCallback(() => {
    setPhase("idle");
    setCode("");
    setError(null);
    setEntries([]);
    setRevealed(new Set());
    setForm(EMPTY_FORM);
    setShowForm(false);
  }, []);

  useEffect(() => {
    if (phase === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, close]);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/panel/vault/challenge", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "שליחת הקוד נכשלה");
      setMaskedEmail(data.email || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  function openGate() {
    setMaskedEmail("");
    setCode("");
    setError(null);
    setPhase("code");
    void sendCode();
  }

  async function unlock(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("יש להזין קוד בן 6 ספרות");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/panel/vault/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "האימות נכשל");
      setEntries(data.entries || []);
      setPhase("open");
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  async function saveEntry(e: FormEvent) {
    e.preventDefault();
    if (!form.label.trim() || !form.secret) {
      setError("יש להזין לפחות שם וסיסמה");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(form.id ? `/api/panel/vault/${form.id}` : "/api/panel/vault", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.label,
          username: form.username,
          secret: form.secret,
          url: form.url,
          notes: form.notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "השמירה נכשלה");
      setEntries(data.entries || []);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(id: string) {
    if (!window.confirm("למחוק את הרשומה לצמיתות?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/panel/vault/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "המחיקה נכשלה");
      setEntries(data.entries || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  function editEntry(entry: VaultEntry) {
    setForm({
      id: entry.id,
      label: entry.label,
      username: entry.username,
      secret: entry.secret,
      url: entry.url || "",
      notes: entry.notes || "",
    });
    setShowForm(true);
    setError(null);
  }

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copySecret(entry: VaultEntry) {
    try {
      await navigator.clipboard.writeText(entry.secret);
      setCopied(entry.id);
      window.setTimeout(() => setCopied((c) => (c === entry.id ? null : c)), 1500);
    } catch {
      setError("ההעתקה נכשלה");
    }
  }

  return (
    <>
      <button type="button" className="admin-tile admin-tile--vault" onClick={openGate}>
        <span className="admin-tile-icon">
          <LockIcon />
        </span>
        <span className="admin-tile-body">
          <span className="admin-tile-title">סיסמאות</span>
          <span className="admin-tile-desc">כספת מוצפנת · נדרש אימות במייל</span>
        </span>
        <span className="admin-tile-ext">
          <KeyIcon />
        </span>
      </button>

      {phase !== "idle" && (
        <div
          className="admin-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="admin-modal">
            <div className="admin-modal-head">
              <h2 className="admin-modal-title">{phase === "code" ? "אימות זהות" : "כספת הסיסמאות"}</h2>
              <button type="button" className="admin-icon-btn" onClick={close} aria-label="סגירה">
                <CloseIcon />
              </button>
            </div>

            <div className="admin-modal-body">
              {error && <div className="admin-feedback admin-feedback--error">{error}</div>}

              {phase === "code" && (
                <form onSubmit={unlock} className="admin-vault-gate">
                  <p className="admin-modal-text">
                    {busy && !maskedEmail ? (
                      "שולח קוד אימות…"
                    ) : maskedEmail ? (
                      <>
                        שלחנו קוד בן 6 ספרות אל <b dir="ltr">{maskedEmail}</b>. הזינו אותו כדי לפתוח את הכספת.
                      </>
                    ) : (
                      "לפתיחת כספת הסיסמאות נדרש אימות נוסף בקוד שנשלח למייל."
                    )}
                  </p>
                  <input
                    className="admin-input admin-vault-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="••••••"
                    dir="ltr"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    autoFocus
                  />
                  <div className="admin-modal-actions">
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void sendCode()} disabled={busy}>
                      שליחת קוד חדש
                    </button>
                    <button type="submit" className="admin-btn admin-btn--primary" disabled={busy || code.length !== 6}>
                      {busy ? "מאמת…" : "פתיחת הכספת"}
                    </button>
                  </div>
                </form>
              )}

              {phase === "open" && (
                <div className="admin-vault">
                  <div className="admin-vault-toolbar">
                    <span className="admin-vault-count">{entries.length} רשומות</span>
                    {!showForm && (
                      <button
                        type="button"
                        className="admin-btn admin-btn--primary"
                        onClick={() => {
                          setForm(EMPTY_FORM);
                          setShowForm(true);
                          setError(null);
                        }}
                      >
                        <PlusIcon />
                        הוספת סיסמה
                      </button>
                    )}
                  </div>

                  {showForm && (
                    <form onSubmit={saveEntry} className="admin-vault-form">
                      <div className="admin-field-grid">
                        <label className="admin-field">
                          <span className="admin-label">שם / שירות</span>
                          <input
                            className="admin-input"
                            value={form.label}
                            onChange={(e) => setForm({ ...form, label: e.target.value })}
                            placeholder="לדוגמה: Supabase"
                            autoFocus
                          />
                        </label>
                        <label className="admin-field">
                          <span className="admin-label">שם משתמש</span>
                          <input
                            className="admin-input"
                            dir="ltr"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                          />
                        </label>
                      </div>
                      <div className="admin-field-grid">
                        <label className="admin-field">
                          <span className="admin-label">סיסמה</span>
                          <input
                            className="admin-input"
                            dir="ltr"
                            value={form.secret}
                            onChange={(e) => setForm({ ...form, secret: e.target.value })}
                          />
                        </label>
                        <label className="admin-field">
                          <span className="admin-label">קישור (לא חובה)</span>
                          <input
                            className="admin-input"
                            dir="ltr"
                            placeholder="https://"
                            value={form.url}
                            onChange={(e) => setForm({ ...form, url: e.target.value })}
                          />
                        </label>
                      </div>
                      <label className="admin-field">
                        <span className="admin-label">הערות (לא חובה)</span>
                        <input
                          className="admin-input"
                          value={form.notes}
                          onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        />
                      </label>
                      <div className="admin-modal-actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost"
                          onClick={() => {
                            setShowForm(false);
                            setForm(EMPTY_FORM);
                          }}
                        >
                          ביטול
                        </button>
                        <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
                          {form.id ? "עדכון" : "שמירה"}
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="admin-vault-list">
                    {entries.length === 0 && !showForm && (
                      <p className="admin-empty">הכספת ריקה — הוסיפו את הסיסמה הראשונה.</p>
                    )}
                    {entries.map((entry) => (
                      <div key={entry.id} className="admin-vault-row">
                        <div className="admin-vault-main">
                          <div className="admin-vault-label">{entry.label}</div>
                          {entry.username && (
                            <div className="admin-vault-user" dir="ltr">
                              {entry.username}
                            </div>
                          )}
                          <div className="admin-vault-secret">
                            <code dir="ltr">{revealed.has(entry.id) ? entry.secret : "••••••••••"}</code>
                            <button
                              type="button"
                              className="admin-icon-btn"
                              onClick={() => toggleReveal(entry.id)}
                              aria-label={revealed.has(entry.id) ? "הסתרה" : "הצגה"}
                            >
                              {revealed.has(entry.id) ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                            <button
                              type="button"
                              className="admin-icon-btn"
                              onClick={() => void copySecret(entry)}
                              aria-label="העתקה"
                            >
                              {copied === entry.id ? <CheckIcon /> : <CopyIcon />}
                            </button>
                          </div>
                          {entry.url && (
                            <a className="admin-vault-link" href={entry.url} target="_blank" rel="noopener noreferrer" dir="ltr">
                              {entry.url}
                              <ExternalIcon />
                            </a>
                          )}
                          {entry.notes && <div className="admin-vault-notes">{entry.notes}</div>}
                        </div>
                        <div className="admin-vault-rowactions">
                          <button type="button" className="admin-icon-btn" onClick={() => editEntry(entry)} aria-label="עריכה">
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn admin-icon-btn--danger"
                            onClick={() => void removeEntry(entry.id)}
                            aria-label="מחיקה"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
