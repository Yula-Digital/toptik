"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { CarouselItem } from "@/lib/carousel/types";

type ProductModalProps = {
  item: CarouselItem | null;
  activeAngleIndex: number;
  onClose: () => void;
  onNextAngle: () => void;
  onPrevAngle: () => void;
  onSelectAngle: (index: number) => void;
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
}: ProductModalProps) {
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!item) return;
    preloadAngleImages(item);
  }, [item]);

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
                sizes="(max-width: 767px) 90vw, 70vw"
                className="product-modal-image"
              />
              <div className="product-modal-cycle-btn" aria-label="הנחיית דפדוף זוויות">
                לזויות נוספות דפדפו בתמונה
              </div>
            </div>

            <div className="product-modal-slider" aria-label="דפדוף זוויות מוצר">
              <button className="product-modal-slider-arrow" onClick={onPrevAngle} aria-label="זווית קודמת">
                ‹
              </button>
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
              <button className="product-modal-slider-arrow" onClick={onNextAngle} aria-label="זווית הבאה">
                ›
              </button>
            </div>
          </div>

          <div className="product-modal-meta">
            <div className="product-modal-catalog">{catalogLabel}</div>
            <div className="product-modal-title">{item.title}</div>
            {item.description && <div className="product-modal-description">{item.description}</div>}
            <div className="product-modal-angle">
              {activeAngleIndex + 1} / {angleCount}
            </div>
          </div>
        </div>
        <button type="button" className="product-modal-close" onClick={onClose} aria-label="סגור">
          ✕
        </button>
      </div>
    </div>
  );
}
