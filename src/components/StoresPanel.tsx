"use client";

import { useEffect, useState } from "react";

export type Store = {
  id: string;
  name: string;
  address: string;
  phone: string;
  phoneRaw: string;
  hours: string;
  mapQuery: string;
};

type Props = { stores: Store[] };

// Stagger map iframe mounts so 3 Google Maps embeds don't race for bandwidth
// at once. Each new card mounts STAGGER_MS after the previous one — same UX
// (maps visible by default), much faster perceived first-paint.
const STAGGER_MS = 1500;

export function StoresPanel({ stores }: Props) {
  const [mountedCount, setMountedCount] = useState(1);

  useEffect(() => {
    if (mountedCount >= stores.length) return;
    const t = setTimeout(() => setMountedCount((c) => c + 1), STAGGER_MS);
    return () => clearTimeout(t);
  }, [mountedCount, stores.length]);

  return (
    <>
      {stores.map((store, i) => (
        <div key={store.id} className="store-card">
          <div className="store-card-map">
            {i < mountedCount ? (
              <iframe
                src={`https://maps.google.com/maps?q=${encodeURIComponent(store.mapQuery)}&output=embed&hl=he&z=16`}
                title={`מפה: ${store.name}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="store-card-map-loading" aria-label="טוען מפה">
                <span className="store-card-map-spinner" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="store-card-info">
            <h2 className="store-card-name">{store.name}</h2>
            <address className="store-card-address">{store.address}</address>
            <a href={`tel:${store.phoneRaw}`} className="store-card-phone">
              {store.phone}
            </a>
            <div className="store-card-hours">
              <strong>שעות פתיחה</strong>
              <span>{store.hours}</span>
            </div>
            <div className="store-nav-btns">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.mapQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="store-nav-btn store-nav-btn--google"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
                </svg>
                נווט עם Google
              </a>
              <a
                href={`https://waze.com/ul?q=${encodeURIComponent(store.mapQuery)}&navigate=yes`}
                target="_blank"
                rel="noopener noreferrer"
                className="store-nav-btn store-nav-btn--waze"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
                </svg>
                נווט עם Waze
              </a>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
