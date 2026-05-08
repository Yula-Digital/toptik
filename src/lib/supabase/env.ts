const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminToken = process.env.ADMIN_PANEL_TOKEN?.trim();

export const supabaseEnv = {
  publicUrl,
  publicAnonKey,
  serviceRoleKey,
  adminToken,
};

export function hasSupabasePublicEnv() {
  return Boolean(supabaseEnv.publicUrl && supabaseEnv.publicAnonKey);
}

export function hasSupabaseAdminEnv() {
  return Boolean(
    supabaseEnv.publicUrl &&
      supabaseEnv.publicAnonKey &&
      supabaseEnv.serviceRoleKey &&
      supabaseEnv.adminToken,
  );
}
