"use client";

import { useEffect, useState } from "react";
import { CarouselItem } from "@/lib/carousel/types";
import type { ProductDetails, SpecSection, ColorSwatch } from "@/lib/catalog-source/product-details";

type TechSpecsModalProps = {
  item: CarouselItem | null;
  onClose: () => void;
};

type FetchState = "idle" | "loading" | "done" | "error";

export function TechSpecsModal({ item, onClose }: TechSpecsModalProps) {
  const [details, setDetails] = useState<ProductDetails | null>(null);
  const [state, setState] = useState<FetchState>("idle");

  useEffect(() => {
    if (!item) {
      setDetails(null);
      setState("idle");
      return;
    }

    const url = item.sourceUrl;
    if (!url) {
      setState("done");
      setDetails({ specs: [], colors: [] });
      return;
    }

    setState("loading");
    const controller = new AbortController();

    fetch(`/api/product-details?url=${encodeURIComponent(url)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: ProductDetails) => {
        setDetails(data);
        setState("done");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setState("error");
      });

    return () => controller.abort();
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="tech-specs-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`פרטים טכניים — ${item.title}`}
      onClick={onClose}
    >
      <div className="tech-specs-modal" onClick={(e) => e.stopPropagation()}>
        <button className="tech-specs-close" onClick={onClose} aria-label="סגור">✕</button>

        <h2 className="tech-specs-title">פרטים טכניים</h2>
        {item.catalogNumber && (
          <div className="tech-specs-catalog">דגם {item.catalogNumber}</div>
        )}

        {state === "loading" && (
          <div className="tech-specs-loading">טוען נתונים...</div>
        )}

        {state === "error" && (
          <div className="tech-specs-error">לא ניתן לטעון פרטים כרגע</div>
        )}

        {state === "done" && details && (
          <>
            {details.specs.length === 0 && (
              <div className="tech-specs-empty">לא נמצאו פרטים טכניים למוצר זה</div>
            )}
            {details.specs.map((section: SpecSection, i: number) => (
              <div key={i} className="tech-specs-section">
                <div className="tech-specs-section-heading">{section.heading}</div>
                <ul className="tech-specs-list">
                  {section.items.map((item, j) => (
                    <li key={j} className="tech-specs-item">
                      {item.value ? (
                        <>
                          <span className="tech-specs-item-label">{item.label}</span>
                          <span className="tech-specs-item-value">{item.value}</span>
                        </>
                      ) : (
                        <span className="tech-specs-item-full">{item.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
