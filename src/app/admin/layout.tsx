import type { ReactNode } from "react";

// Render /admin fresh on every request instead of statically prerendering it, so
// the served HTML always references the CURRENT deployment's client chunks. After
// rapid successive deploys a stale prerendered shell can reference chunks that no
// longer exist, leaving the page blank/inert even after a hard refresh; forcing
// dynamic rendering removes that failure mode.
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
