import Link from "next/link";
import { requirePanelUser } from "@/lib/admin/supabase-server";
import { LANDING_URL, SHOPIFY_STORE_URL } from "@/lib/admin/config";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import {
  SettingsIcon,
  GalleryIcon,
  LandingIcon,
  ShopIcon,
  WhatsappIcon,
  ExternalIcon,
} from "@/components/admin/icons";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requirePanelUser();

  return (
    <>
      <AdminTopBar email={user.email ?? null} />
      <main className="admin-main">
        <div className="admin-page-head">
          <p className="admin-eyebrow">לוח בקרה</p>
          <h1 className="admin-title">ברוכים הבאים לפאנל הניהול</h1>
          <p className="admin-subtitle">בחרו את הפעולה שברצונכם לבצע.</p>
        </div>

        <nav className="admin-grid" aria-label="תפריט ניהול">
          <Link href="/settings" className="admin-tile">
            <span className="admin-tile-icon">
              <SettingsIcon />
            </span>
            <span className="admin-tile-body">
              <span className="admin-tile-title">הגדרות אדמין</span>
              <span className="admin-tile-desc">ניהול משתמשי מנהל, הזמנת מנהלים חדשים ואיפוס סיסמאות.</span>
            </span>
          </Link>

          <Link href="/admin" className="admin-tile">
            <span className="admin-tile-icon">
              <GalleryIcon />
            </span>
            <span className="admin-tile-body">
              <span className="admin-tile-title">עדכון גלריית דף הנחיתה</span>
              <span className="admin-tile-desc">מעבר לעורך הקרוסלה של דף הבית.</span>
            </span>
          </Link>

          <a href={LANDING_URL} target="_blank" rel="noopener noreferrer" className="admin-tile">
            <span className="admin-tile-icon">
              <LandingIcon />
            </span>
            <span className="admin-tile-body">
              <span className="admin-tile-title">דף הנחיתה</span>
              <span className="admin-tile-desc">צפייה בדף הנחיתה החי בכרטיסייה חדשה.</span>
            </span>
            <span className="admin-tile-ext">
              <ExternalIcon />
            </span>
          </a>

          <a href={SHOPIFY_STORE_URL} target="_blank" rel="noopener noreferrer" className="admin-tile admin-tile--brass">
            <span className="admin-tile-icon">
              <ShopIcon />
            </span>
            <span className="admin-tile-body">
              <span className="admin-tile-title">חנות שופיפיי</span>
              <span className="admin-tile-desc">מעבר לחנות האונליין בשופיפיי בכרטיסייה חדשה.</span>
            </span>
            <span className="admin-tile-ext">
              <ExternalIcon />
            </span>
          </a>

          <div className="admin-tile admin-tile--disabled" aria-disabled="true">
            <span className="admin-tile-icon">
              <WhatsappIcon />
            </span>
            <span className="admin-tile-body">
              <span className="admin-tile-title">
                סוכן וואטסאפ AI
                <span className="admin-chip admin-chip--off">
                  <span className="admin-chip-dot" />
                  בקרוב
                </span>
              </span>
              <span className="admin-tile-desc">הפעלה והגדרה של סוכן הוואטסאפ — בפיתוח, יתווסף בהמשך.</span>
            </span>
          </div>
        </nav>
      </main>
    </>
  );
}
