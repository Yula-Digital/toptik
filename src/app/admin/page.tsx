import { redirect } from "next/navigation";

// The admin experience moved to the panel surface (served on
// admin.toptik.co.il). The carousel "secret zone" still links to /admin, so we
// funnel it into the new dashboard, which redirects to /login when signed out.
export default function LegacyAdminRedirect() {
  redirect("/dashboard");
}
