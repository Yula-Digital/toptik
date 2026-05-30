"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { CarouselItem } from "@/lib/carousel/types";
import type { ColorSwatch } from "@/lib/catalog-source/product-details";
import { extractColorWord, COLOR_HEBREW } from "@/lib/carousel/color-groups";
import { trimmedProductSrc } from "@/lib/carousel/trim-src";

type ProductModalProps = {
  item: CarouselItem | null;
  activeAngleIndex: number;
  colors?: ColorSwatch[];
  onClose: () => void;
  onNextAngle: () => void;
  onPrevAngle: () => void;
  onSelectAngle: (index: number) => void;
  onOpenTechSpecs: (item: CarouselItem) => void;
};

export function ProductModal({
  item,
  activeAngleIndex,
  colors = [],
  onClose,
  onNextAngle,
  onPrevAngle,
  onSelectAngle,
  onOpenTechSpecs,
}: ProductModalProps) {
  const touchStartX = useRef<number | null>(null);

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
                  src={trimmedProductSrc(activeAngle?.imagePath ?? "")}
                  alt={`${item.title} - ${activeAngle?.angleKey ?? "view"}`}
                  width={1600}
                  height={1600}
                  sizes="(max-width: 767px) 90vw, 55vw"
                  className="product-modal-image"
                />
                <div className="product-modal-cycle-btn product-modal-cycle-btn--icon" aria-label="לזוויות נוספות דפדפו">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/360.png" alt="" aria-hidden="true" className="product-modal-cycle-icon" />
                </div>

                {/* side arrows — inside image frame, pointing outward */}
                <button
                  className="product-modal-side-arrow product-modal-side-arrow--prev"
                  onClick={(e) => { e.stopPropagation(); onPrevAngle(); }}
                  aria-label="זווית קודמת"
                >
                  ‹
                </button>
                <button
                  className="product-modal-side-arrow product-modal-side-arrow--next"
                  onClick={(e) => { e.stopPropagation(); onNextAngle(); }}
                  aria-label="זווית הבאה"
                >
                  ›
                </button>
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
              {colors.length > 0 && (() => {
                const activeColorWord = extractColorWord(item.title);
                return (
                  <div className="product-modal-colors" dir="rtl">
                    <span className="product-modal-colors-label">צבעים</span>
                    <div className="product-modal-colors-swatches">
                      {colors.map((c, i) => {
                        const swatchColor = Object.entries(COLOR_HEBREW).find(([, v]) => v === c.name)?.[0] ?? c.name.toLowerCase();
                        const isActive = activeColorWord ? swatchColor === activeColorWord : false;
                        return (
                          <span
                            key={i}
                            className={`product-modal-color-dot${isActive ? " is-current" : ""}`}
                            title={c.name}
                            style={c.hex ? { background: c.hex } : undefined}
                            aria-label={c.name}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
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
                לנתונים טכנים
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
