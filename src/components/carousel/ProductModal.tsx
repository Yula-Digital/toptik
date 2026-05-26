"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CarouselItem } from "@/lib/carousel/types";
import type { ColorSwatch } from "@/lib/catalog-source/product-details";

type ProductModalProps = {
  item: CarouselItem | null;
  activeAngleIndex: number;
  onClose: () => void;
  onNextAngle: () => void;
  onPrevAngle: () => void;
  onSelectAngle: (index: number) => void;
  onOpenTechSpecs: (item: CarouselItem) => void;
};

function preloadAngleImages(item: CarouselItem) {
  if (typeof window === "undefined") return;
  item.angles.forEach((angle) => {
    const image = new window.Image();
    image.decoding = "async";
    image.src = angle.imagePath;
  });
}

export function ProductModal({
  item,
  activeAngleIndex,
  onClose,
  onNextAngle,
  onPrevAngle,
  onSelectAngle,
  onOpenTechSpecs,
}: ProductModalProps) {
  const touchStartX = useRef<number | null>(null);
  const [colors, setColors] = useState<ColorSwatch[]>([]);

  useEffect(() => {
    if (!item) return;
    preloadAngleImages(item);
  }, [item]);

  // Fetch colors when item changes
  useEffect(() => {
    setColors([]);
    if (!item?.sourceUrl) return;
    const controller = new AbortController();
    fetch(`/api/product-details?url=${encodeURIComponent(item.sourceUrl)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: { colors?: ColorSwatch[] }) => {
        if (data.colors?.length) setColors(data.colors);
      })
      .catch(() => {/* silent */});
    return () => controller.abort();
  }, [item?.sourceUrl]);

  useEffect(() => {
    if (!item) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" || event.key === " ") onNextAngle();
      if (event.key === "ArrowLeft") onPrevAngle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose, onNextAngle, onPrevAngle]);

  if (!item) return null;
  const activeAngle = item.angles[activeAngleIndex] ?? item.angles[0];
  const catalogLabel = item.catalogNumber ? `דגם ${item.catalogNumber}` : "דגם";
  const angleCount = item.angles.length;

  function onTouchEnd(clientX: number) {
    if (touchStartX.current === null) return;
    const delta = clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 36) return;
    if (delta < 0) onNextAngle();
    else onPrevAngle();
  }

  return (
    <div
      className="product-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`תצוגת מוצר ${item.title}`}
      onClick={onClose}
    >
      <div className="product-modal" onClick={(e) => e.stopPropagation()}>
        <div className="product-modal-content">
          <div className="product-modal-gallery">

            {/* side arrows — inside gallery, centred vertically on image */}
            <button
              className="product-modal-side-arrow product-modal-side-arrow--prev"
              onClick={(e) => { e.stopPropagation(); onPrevAngle(); }}
              aria-label="זווית קודמת"
            >
              ›
            </button>

            <div className="product-modal-gallery-center">
              {/* image */}
              <div
                className="product-modal-image-wrap"
                onClick={onNextAngle}
                onTouchStart={(event) => {
                  touchStartX.current = event.touches[0]?.clientX ?? null;
                }}
                onTouchEnd={(event) => onTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
                role="button"
                tabIndex={0}
                aria-label="דפדף לזווית הבאה"
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onNextAngle();
                }}
              >
                <Image
                  src={activeAngle?.imagePath || item.coverImagePath}
                  alt={`${item.title} - ${activeAngle?.angleKey ?? "view"}`}
                  width={1600}
                  height={1600}
                  sizes="(max-width: 767px) 90vw, 55vw"
                  className="product-modal-image"
                />
                <div className="product-modal-cycle-btn" aria-label="הנחיית דפדוף זוויות">
                  לזוויות נוספות דפדפו בתמונה
                </div>
              </div>

              {/* dots */}
              <div className="product-modal-slider" aria-label="דפדוף זוויות מוצר">
                <div className="product-modal-slider-dots">
                  {item.angles.map((angle, index) => (
                    <button
                      key={angle.id}
                      className={`product-modal-slider-dot${index === activeAngleIndex ? " is-active" : ""}`}
                      onClick={() => onSelectAngle(index)}
                      aria-label={`עבור לזווית ${index + 1}`}
                      aria-current={index === activeAngleIndex ? "true" : undefined}
                    />
                  ))}
                </div>
              </div>

              {/* color swatches */}
              {colors.length > 0 && (
                <div className="product-modal-colors" dir="rtl">
                  <span className="product-modal-colors-label">צבעים</span>
                  <div className="product-modal-colors-swatches">
                    {colors.map((c, i) => (
                      <span
                        key={i}
                        className="product-modal-color-dot"
                        title={c.name}
                        style={c.hex ? { background: c.hex } : undefined}
                        aria-label={c.name}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              className="product-modal-side-arrow product-modal-side-arrow--next"
              onClick={(e) => { e.stopPropagation(); onNextAngle(); }}
              aria-label="זווית הבאה"
            >
              ‹
            </button>
          </div>

          <div className="product-modal-meta">
            <div className="product-modal-catalog">{catalogLabel}</div>
            <div className="product-modal-title">{item.title}</div>
            {item.description && <div className="product-modal-description">{item.description}</div>}
            <div className="product-modal-angle">
              {activeAngleIndex + 1} / {angleCount}
            </div>
            {item.sourceUrl && (
              <button
                className="product-modal-tech-btn"
                onClick={(e) => { e.stopPropagation(); onOpenTechSpecs(item); }}
                aria-label="פרטים טכניים"
              >
                לנתונים טכניים
              </button>
            )}
          </div>
        </div>
        <button type="button" className="product-modal-close" onClick={onClose} aria-label="סגור">
          ✕
        </button>
      </div>
    </div>
  );
}
