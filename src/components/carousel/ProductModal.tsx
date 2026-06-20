"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CarouselItem } from "@/lib/carousel/types";
import type { ResolvedSwatch } from "@/lib/carousel/colors";
import { trimmedProductSrc } from "@/lib/carousel/trim-src";
import { nextImageSrcset, nextImageUrl } from "@/lib/carousel/next-image";

// The modal <Image> renders at this `sizes`, with next/image's default quality (75).
const MODAL_IMAGE_SIZES = "(max-width: 767px) 90vw, 55vw";

type ProductModalProps = {
  item: CarouselItem | null;
  colors?: ResolvedSwatch[];
  onClose: () => void;
  onOpenTechSpecs: (item: CarouselItem) => void;
};

// Preload every image of the CURRENT gallery so rotating (and switching colours)
// is instant. Mobile uses a responsive preload matching the modal <Image> so it's
// a real cache hit; the active image + neighbours warm first, the tail defers.
function preloadGalleryImages(paths: string[], activeIndex: number) {
  if (typeof window === "undefined") return;
  const count = paths.length;
  if (count === 0) return;
  const isMobile = window.matchMedia("(max-width: 767px)").matches;

  const order = [...paths.keys()].sort((a, b) => {
    const da = Math.min((a - activeIndex + count) % count, (activeIndex - a + count) % count);
    const db = Math.min((b - activeIndex + count) % count, (activeIndex - b + count) % count);
    return da - db;
  });

  const created: HTMLLinkElement[] = [];
  const addPreload = (src: string, eager: boolean) => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    if (isMobile) {
      link.setAttribute("imagesrcset", nextImageSrcset(src));
      link.setAttribute("imagesizes", MODAL_IMAGE_SIZES);
    } else {
      link.href = nextImageUrl(src, 1080, 85);
    }
    link.setAttribute("fetchpriority", eager ? "high" : "low");
    document.head.appendChild(link);
    created.push(link);
  };

  const scheduleIdle =
    (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ??
    ((cb: () => void) => window.setTimeout(cb, 300));

  order.forEach((idx, position) => {
    const src = trimmedProductSrc(paths[idx]);
    const eager = position <= 2;
    if (isMobile && !eager) scheduleIdle(() => addPreload(src, false));
    else addPreload(src, eager);
  });

  window.setTimeout(() => created.forEach((link) => link.remove()), 30000);
}

export function ProductModal({ item, colors = [], onClose, onOpenTechSpecs }: ProductModalProps) {
  const touchStartX = useRef<number | null>(null);
  // The modal is remounted per item (keyed by id in the parent), so initialising
  // the selected colour to the item's own colour runs once per open.
  const [selectedColorKey, setSelectedColorKey] = useState<string | null>(
    () => colors.find((c) => c.isCurrent)?.key ?? null,
  );
  const [angleIdx, setAngleIdx] = useState(0);

  const currentSwatch = colors.find((c) => c.key === selectedColorKey) ?? null;

  // The active rotation gallery: the selected colour's angles, else the item's
  // own imported angles, else its cover. Switching colour swaps the whole gallery.
  const gallery: string[] =
    currentSwatch && currentSwatch.angles.length > 0
      ? currentSwatch.angles
      : item && item.angles.length > 0
        ? item.angles.map((a) => a.imagePath)
        : item?.coverImagePath
          ? [item.coverImagePath]
          : [];
  const count = gallery.length;
  const safeIdx = count > 0 ? Math.min(angleIdx, count - 1) : 0;

  useEffect(() => {
    if (!item) return;
    preloadGalleryImages(gallery, safeIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, selectedColorKey]);

  useEffect(() => {
    if (!item) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" || event.key === " ") setAngleIdx((i) => (count ? (i + 1) % count : 0));
      if (event.key === "ArrowLeft") setAngleIdx((i) => (count ? (i - 1 + count) % count : 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose, count]);

  if (!item) return null;

  const displayed = gallery[safeIdx] ?? item.coverImagePath;
  const catalogLabel = item.catalogNumber ? `דגם ${item.catalogNumber}` : "דגם";

  const next = () => setAngleIdx((i) => (count ? (i + 1) % count : 0));
  const prev = () => setAngleIdx((i) => (count ? (i - 1 + count) % count : 0));
  const selectColor = (key: string) => {
    setSelectedColorKey(key);
    setAngleIdx(0);
  };

  function onTouchEnd(clientX: number) {
    if (touchStartX.current === null) return;
    const delta = clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 36) return;
    if (delta < 0) next();
    else prev();
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
                onClick={next}
                onTouchStart={(event) => {
                  touchStartX.current = event.touches[0]?.clientX ?? null;
                }}
                onTouchEnd={(event) => onTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
                role="button"
                tabIndex={0}
                aria-label="דפדף לזווית הבאה"
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") next();
                }}
              >
                {displayed && (
                  <Image
                    src={trimmedProductSrc(displayed)}
                    alt={`${item.title} - ${safeIdx + 1}`}
                    width={1600}
                    height={1600}
                    sizes="(max-width: 767px) 90vw, 55vw"
                    className="product-modal-image"
                  />
                )}
                <div className="product-modal-cycle-btn product-modal-cycle-btn--icon" aria-label="לזוויות נוספות דפדפו">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/360.png" alt="" aria-hidden="true" className="product-modal-cycle-icon" />
                </div>

                {/* side arrows — inside image frame, pointing outward */}
                <button
                  className="product-modal-side-arrow product-modal-side-arrow--prev"
                  onClick={(e) => { e.stopPropagation(); prev(); }}
                  aria-label="זווית קודמת"
                >
                  ‹
                </button>
                <button
                  className="product-modal-side-arrow product-modal-side-arrow--next"
                  onClick={(e) => { e.stopPropagation(); next(); }}
                  aria-label="זווית הבאה"
                >
                  ›
                </button>
              </div>

              {/* dots */}
              <div className="product-modal-slider" aria-label="דפדוף זוויות מוצר">
                <div className="product-modal-slider-dots">
                  {gallery.map((path, index) => (
                    <button
                      key={`${path}-${index}`}
                      className={`product-modal-slider-dot${index === safeIdx ? " is-active" : ""}`}
                      onClick={() => setAngleIdx(index)}
                      aria-label={`עבור לזווית ${index + 1}`}
                      aria-current={index === safeIdx ? "true" : undefined}
                    />
                  ))}
                </div>
              </div>

              {/* color swatches */}
              {colors.length > 0 && (
                <div className="product-modal-colors" dir="rtl">
                  <span className="product-modal-colors-label">צבעים</span>
                  <div className="product-modal-colors-swatches">
                    {colors.map((c) => {
                      const selected = c.key === selectedColorKey;
                      return (
                        <button
                          key={c.key}
                          type="button"
                          className={`product-modal-color-dot${selected ? " is-current" : ""} is-actionable`}
                          title={c.name}
                          style={c.hex ? { background: c.hex } : undefined}
                          aria-label={c.name}
                          aria-pressed={selected}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectColor(c.key);
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="product-modal-meta">
            <div className="product-modal-catalog">{catalogLabel}</div>
            <div className="product-modal-title">{item.title}</div>
            {item.description && <div className="product-modal-description">{item.description}</div>}
            <div className="product-modal-angle">
              {safeIdx + 1} / {count}
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
