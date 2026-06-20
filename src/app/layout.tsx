import type { Metadata } from "next";
import {
  Italiana,
  Great_Vibes,
  Rubik,
  Playfair_Display,
  Assistant,
} from "next/font/google";
import "./globals.css";

const italiana = Italiana({
  subsets: ["latin"],
  variable: "--font-italiana",
  weight: ["400"],
  display: "swap",
});

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  variable: "--font-great-vibes",
  weight: ["400"],
  display: "swap",
});

const rubik = Rubik({
  subsets: ["latin", "hebrew"],
  variable: "--font-rubik",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const assistant = Assistant({
  subsets: ["latin", "hebrew"],
  variable: "--font-assistant",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  // Canonical home of the landing page. The apex toptik.co.il was returned to
  // the Shopify store on 2026-06-20; this Vercel app now lives on the
  // `landing` subdomain. See docs/LANDING-SUBDOMAIN.md.
  metadataBase: new URL("https://landing.toptik.co.il"),
  title: "TopTik Collection — Move in Style. Travel with Purpose.",
  description: "TopTik — דף נחיתה רשמי",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#fdf8ee",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${italiana.variable} ${greatVibes.variable} ${rubik.variable} ${playfair.variable} ${assistant.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
