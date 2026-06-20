import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";

export type WhatsappProvider = "" | "whatsapp_cloud" | "twilio" | "custom";

export type WhatsappConfig = {
  provider: WhatsappProvider;
  /** Display number in international format, e.g. +972-50-000-0000. */
  phoneNumber: string;
  /** Provider-specific sender id (e.g. WhatsApp Cloud API phone_number_id). */
  phoneNumberId: string;
  /** Secret token — stored server-side only, never returned raw to the browser. */
  accessToken: string;
  /** System prompt that shapes the AI agent's persona / guardrails. */
  systemPrompt: string;
  autoReply: boolean;
  businessHoursOnly: boolean;
};

export type AdminSettings = {
  whatsappEnabled: boolean;
  whatsapp: WhatsappConfig;
  updatedAt: string | null;
  updatedBy: string | null;
};

/** Browser-safe shape: the secret token is replaced by a boolean. */
export type AdminSettingsPublic = {
  whatsappEnabled: boolean;
  whatsapp: Omit<WhatsappConfig, "accessToken"> & { accessTokenSet: boolean };
  updatedAt: string | null;
  updatedBy: string | null;
};

export function defaultWhatsappConfig(): WhatsappConfig {
  return {
    provider: "",
    phoneNumber: "",
    phoneNumberId: "",
    accessToken: "",
    systemPrompt:
      "אתה נציג שירות AI של TOPTIK. ענה בעברית, בנימוס ובקצרה, ועזור ללקוחות בשאלות על מזוודות, תיקים ומשלוחים.",
    autoReply: true,
    businessHoursOnly: false,
  };
}

export function defaultAdminSettings(): AdminSettings {
  return {
    whatsappEnabled: false,
    whatsapp: defaultWhatsappConfig(),
    updatedAt: null,
    updatedBy: null,
  };
}

type AdminSettingsRow = {
  whatsapp_enabled: boolean | null;
  whatsapp_config: Partial<WhatsappConfig> | null;
  updated_at: string | null;
  updated_by: string | null;
};

function mapRow(row: AdminSettingsRow): AdminSettings {
  return {
    whatsappEnabled: Boolean(row.whatsapp_enabled),
    whatsapp: { ...defaultWhatsappConfig(), ...(row.whatsapp_config ?? {}) },
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

/** Reads the singleton settings row. Degrades gracefully to defaults. */
export async function getAdminSettings(): Promise<AdminSettings> {
  if (!hasSupabaseAdminEnv()) return defaultAdminSettings();
  const admin = createSupabaseServiceRoleClient();
  const { data, error } = await admin
    .from("admin_settings")
    .select("whatsapp_enabled,whatsapp_config,updated_at,updated_by")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return defaultAdminSettings();
  return mapRow(data as AdminSettingsRow);
}

export async function saveAdminSettings(
  next: { whatsappEnabled: boolean; whatsapp: WhatsappConfig },
  updatedBy: string | null,
): Promise<void> {
  const admin = createSupabaseServiceRoleClient();
  const { error } = await admin.from("admin_settings").upsert({
    id: 1,
    whatsapp_enabled: next.whatsappEnabled,
    whatsapp_config: next.whatsapp,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  });
  if (error) throw error;
}

/** Strips the secret token before sending settings to the browser. */
export function toPublicSettings(settings: AdminSettings): AdminSettingsPublic {
  const { accessToken, ...rest } = settings.whatsapp;
  return {
    whatsappEnabled: settings.whatsappEnabled,
    whatsapp: { ...rest, accessTokenSet: accessToken.trim().length > 0 },
    updatedAt: settings.updatedAt,
    updatedBy: settings.updatedBy,
  };
}
