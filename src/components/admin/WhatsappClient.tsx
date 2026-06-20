"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckIcon } from "@/components/admin/icons";

type PublicWhatsapp = {
  provider: "" | "whatsapp_cloud" | "twilio" | "custom";
  phoneNumber: string;
  phoneNumberId: string;
  accessTokenSet: boolean;
  systemPrompt: string;
  autoReply: boolean;
  businessHoursOnly: boolean;
};

type PublicSettings = {
  whatsappEnabled: boolean;
  whatsapp: PublicWhatsapp;
  updatedAt: string | null;
  updatedBy: string | null;
};

type Feedback = { tone: "success" | "error" | "info"; message: string } | null;

const PROVIDERS: { value: PublicWhatsapp["provider"]; label: string }[] = [
  { value: "", label: "— בחרו ספק —" },
  { value: "whatsapp_cloud", label: "WhatsApp Cloud API (Meta)" },
  { value: "twilio", label: "Twilio" },
  { value: "custom", label: "אחר / מותאם אישית" },
];

export function WhatsappClient() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/panel/settings");
      const data = (await res.json().catch(() => null)) as { settings?: PublicSettings; error?: string } | null;
      if (!res.ok || !data?.settings) throw new Error(data?.error ?? "טעינת ההגדרות נכשלה");
      setSettings(data.settings);
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "שגיאה" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patchWhatsapp(patch: Partial<PublicWhatsapp>) {
    setSettings((current) => (current ? { ...current, whatsapp: { ...current.whatsapp, ...patch } } : current));
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/panel/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappEnabled: settings.whatsappEnabled,
          whatsapp: {
            provider: settings.whatsapp.provider,
            phoneNumber: settings.whatsapp.phoneNumber,
            phoneNumberId: settings.whatsapp.phoneNumberId,
            accessToken: tokenInput, // blank → server keeps the stored token
            systemPrompt: settings.whatsapp.systemPrompt,
            autoReply: settings.whatsapp.autoReply,
            businessHoursOnly: settings.whatsapp.businessHoursOnly,
          },
        }),
      });
      const data = (await res.json().catch(() => null)) as { settings?: PublicSettings; error?: string } | null;
      if (!res.ok || !data?.settings) throw new Error(data?.error ?? "שמירת ההגדרות נכשלה");
      setSettings(data.settings);
      setTokenInput("");
      setFeedback({ tone: "success", message: "ההגדרות נשמרו בהצלחה." });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "שגיאה" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="admin-card admin-empty">טוען הגדרות…</div>;
  }
  if (!settings) {
    return (
      <div className="admin-card">
        <div className="admin-feedback admin-feedback--error">לא ניתן לטעון את ההגדרות.</div>
      </div>
    );
  }

  const wa = settings.whatsapp;

  return (
    <>
      {feedback && (
        <div className={`admin-feedback admin-feedback--${feedback.tone}`} role="status">
          {feedback.message}
        </div>
      )}

      <div className="admin-card">
        <label className={`admin-switch-row ${settings.whatsappEnabled ? "is-on" : ""}`}>
          <span className="admin-switch-copy">
            <b>הפעלת סוכן וואטסאפ AI</b>
            <span>כשהסוכן פעיל, הוא יענה אוטומטית להודעות לקוחות בוואטסאפ.</span>
          </span>
          <span className="admin-switch">
            <input
              type="checkbox"
              checked={settings.whatsappEnabled}
              onChange={(e) => setSettings({ ...settings, whatsappEnabled: e.target.checked })}
            />
            <span className="admin-switch-track">
              <span className="admin-switch-thumb" />
            </span>
          </span>
        </label>
      </div>

      <div className="admin-card">
        <div className="admin-card-head">
          <h2 className="admin-card-title">הגדרות חיבור</h2>
          <p className="admin-card-desc">
            פרטי החיבור לספק הוואטסאפ. החיבור עצמו (runtime) יחובר בהמשך — כרגע הפרטים נשמרים בלבד.
          </p>
        </div>

        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label" htmlFor="wa-provider">
              ספק
            </label>
            <select
              id="wa-provider"
              className="admin-select"
              value={wa.provider}
              onChange={(e) => patchWhatsapp({ provider: e.target.value as PublicWhatsapp["provider"] })}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label className="admin-label" htmlFor="wa-phone">
              מספר וואטסאפ עסקי
            </label>
            <input
              id="wa-phone"
              className="admin-input"
              dir="ltr"
              value={wa.phoneNumber}
              onChange={(e) => patchWhatsapp({ phoneNumber: e.target.value })}
              placeholder="+972-50-000-0000"
            />
          </div>

          <div className="admin-field">
            <label className="admin-label" htmlFor="wa-phone-id">
              מזהה שולח (Phone Number ID)
            </label>
            <input
              id="wa-phone-id"
              className="admin-input"
              dir="ltr"
              value={wa.phoneNumberId}
              onChange={(e) => patchWhatsapp({ phoneNumberId: e.target.value })}
              placeholder="123456789012345"
            />
          </div>

          <div className="admin-field">
            <label className="admin-label" htmlFor="wa-token">
              טוקן גישה (API Token)
            </label>
            <input
              id="wa-token"
              className="admin-input"
              type="password"
              dir="ltr"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={wa.accessTokenSet ? "•••••••• (טוקן שמור)" : "הדביקו טוקן"}
            />
            <span className="admin-hint">
              {wa.accessTokenSet
                ? "קיים טוקן שמור. השאירו ריק כדי לא לשנותו, או הדביקו טוקן חדש להחלפה."
                : "הטוקן נשמר בצד השרת בלבד ולא מוצג שוב."}
            </span>
          </div>
        </div>

        <div className="admin-field" style={{ marginTop: 4 }}>
          <label className="admin-label" htmlFor="wa-prompt">
            פרומפט מערכת (אופי הסוכן)
          </label>
          <textarea
            id="wa-prompt"
            className="admin-textarea"
            value={wa.systemPrompt}
            onChange={(e) => patchWhatsapp({ systemPrompt: e.target.value })}
            placeholder="הנחיות לסוכן: טון, שפה, מה מותר ומה אסור לענות…"
          />
        </div>

        <label className="admin-switch-row" style={{ marginTop: 6 }}>
          <span className="admin-switch-copy">
            <b>מענה אוטומטי</b>
            <span>שליחת תשובה אוטומטית לכל הודעה נכנסת.</span>
          </span>
          <span className="admin-switch">
            <input
              type="checkbox"
              checked={wa.autoReply}
              onChange={(e) => patchWhatsapp({ autoReply: e.target.checked })}
            />
            <span className="admin-switch-track">
              <span className="admin-switch-thumb" />
            </span>
          </span>
        </label>

        <label className="admin-switch-row" style={{ marginTop: 10 }}>
          <span className="admin-switch-copy">
            <b>שעות פעילות בלבד</b>
            <span>הסוכן יענה רק בשעות הפעילות של העסק.</span>
          </span>
          <span className="admin-switch">
            <input
              type="checkbox"
              checked={wa.businessHoursOnly}
              onChange={(e) => patchWhatsapp({ businessHoursOnly: e.target.checked })}
            />
            <span className="admin-switch-track">
              <span className="admin-switch-thumb" />
            </span>
          </span>
        </label>

        {settings.updatedAt && (
          <p className="admin-meta-line">
            עודכן לאחרונה: {new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(settings.updatedAt))}
            {settings.updatedBy ? ` · ${settings.updatedBy}` : ""}
          </p>
        )}

        <div className="admin-btn-row" style={{ marginTop: 20 }}>
          <button type="button" className="admin-btn admin-btn--primary" onClick={save} disabled={saving}>
            {saving ? <span className="admin-spin" /> : <CheckIcon />}
            שמירת הגדרות
          </button>
        </div>
      </div>
    </>
  );
}
