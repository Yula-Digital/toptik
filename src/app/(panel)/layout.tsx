import type { Metadata } from "next";
import "./panel.css";

export const metadata: Metadata = {
  title: "TOPTIK — פאנל ניהול",
  description: "פאנל הניהול של TOPTIK",
  robots: { index: false, follow: false },
};

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell" dir="rtl">
      {children}
    </div>
  );
}
