import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { MAX_ADMIN_USERS } from "@/lib/admin/config";

export type AdminUserSummary = {
  id: string;
  email: string | null;
  role: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  invitePending: boolean;
};

function toSummary(user: User): AdminUserSummary {
  const role = typeof user.user_metadata?.role === "string" ? user.user_metadata.role : "admin";
  return {
    id: user.id,
    email: user.email ?? null,
    role,
    createdAt: user.created_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    // An invited user has confirmed nothing and never signed in yet.
    invitePending: !user.last_sign_in_at && !user.email_confirmed_at,
  };
}

/** Lists every admin account (sorted oldest-first, so the owner is on top). */
export async function listAdminUsers(): Promise<AdminUserSummary[]> {
  const admin = createSupabaseServiceRoleClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (error) throw error;
  return data.users
    .map(toSummary)
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

export async function countAdminUsers(client?: SupabaseClient): Promise<number> {
  const admin = client ?? createSupabaseServiceRoleClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (error) throw error;
  return data.users.length;
}

/**
 * Creates the very first ("primary") admin. Caller MUST have already verified
 * the one-time setup token. Refuses to run once any account exists.
 */
export async function createPrimaryAdmin(email: string, password: string): Promise<void> {
  const admin = createSupabaseServiceRoleClient();
  if ((await countAdminUsers(admin)) > 0) {
    throw new Error("הקמה כבר בוצעה — קיים מנהל ראשון.");
  }
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "owner" },
  });
  if (error) throw error;
}

/** Invites an additional admin by email (enforces the 3-account ceiling). */
export async function inviteAdmin(email: string, redirectTo: string): Promise<AdminUserSummary> {
  const admin = createSupabaseServiceRoleClient();
  const existing = await listAdminUsers();
  if (existing.some((u) => u.email?.toLowerCase() === email.toLowerCase())) {
    throw new Error("כתובת המייל כבר רשומה כמנהל.");
  }
  if (existing.length >= MAX_ADMIN_USERS) {
    throw new Error(`ניתן להגדיר עד ${MAX_ADMIN_USERS} מנהלים בלבד.`);
  }
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { role: "admin" },
  });
  if (error) throw error;
  return toSummary(data.user);
}

/** Removes an admin. Never lets the last remaining account be deleted. */
export async function deleteAdmin(id: string): Promise<void> {
  const admin = createSupabaseServiceRoleClient();
  const users = await listAdminUsers();
  if (users.length <= 1) {
    throw new Error("לא ניתן למחוק את המנהל האחרון שנותר.");
  }
  if (!users.some((u) => u.id === id)) {
    throw new Error("המנהל לא נמצא.");
  }
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw error;
}

/** Sends a password-reset email to an existing admin (self-service or admin-initiated). */
export async function sendResetEmail(email: string, redirectTo: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}
