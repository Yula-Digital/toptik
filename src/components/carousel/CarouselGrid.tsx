"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { A11y, Autoplay, Keyboard, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import { CarouselItem } from "@/lib/carousel/types";
import type { ColorSwatch } from "@/lib/catalog-source/product-details";
import { buildItemColorGroups, extractColorWord, COLOR_HEBREW } from "@/lib/carousel/color-groups";
import { trimmedProductSrc } from "@/lib/carousel/trim-src";
import { nextImageSrcset } from "@/lib/carousel/next-image";

// Matches ProductModal's <Image sizes>; used to pre-warm the modal-size image on mobile.
const MODAL_IMAGE_SIZES = "(max-width: 767px) 90vw, 55vw";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

type CarouselGridProps = {
  items: CarouselItem[];
  autoplayMs: number;
  onOpenItem: (item: CarouselItem) => void;
  onOpenTechSpecs: (item: CarouselItem) => void;
};

// Warm a card's angle images when the user signals open-intent (hover/touch).
// MOBILE: preload the exact modal-size resource (responsive imagesrcset matching
// ProductModal) so opening the product is instant — and far lighter than pulling
// the full-resolution trim onto a phone. DESKTOP: unchanged full-res trim warm.
function preloadAngleImages(item: CarouselItem) {
  if (typeof window === "undefined") return;
  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  item.angles.forEach((angle) => {
    const src = trimmedProductSrc(angle.imagePath);
    if (isMobile) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.setAttribute("imagesrcset", nextImageSrcset(src));
      link.setAttribute("imagesizes", MODAL_IMAGE_SIZES);
      link.setAttribute("fetchpriority", "low");
      document.head.appendChild(link);
      setTimeout(() => link.remove(), 30000);
    } else {
      const image = new window.Image();
      image.decoding = "async";
      image.src = src;
    }
  });
}

function extractCatalogNumber(item: CarouselItem) {
  const explicit = item.catalogNumber?.trim();
  if (explicit) return explicit;
  const titleToken = item.title.match(/[A-Z0-9]{2,}(?:[-_/][A-Z0-9]{2,})+/i)?.[0];
  return titleToken ?? "";
}

function chunkItems(items: CarouselItem[], size: number) {
  const chunks: CarouselItem[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function CardColors({ swatches, activeColorWord }: { swatches: ColorSwatch[]; activeColorWord: string | null }) {
  if (swatches.length === 0) return null;
  return (
    <div className="catalog-card-colors" dir="rtl">
      <span className="catalog-card-colors-label">צבעים</span>
      <div className="catalog-card-colors-dots">
        {swatches.map((c, i) => {
          const swatchColor = Object.entries(COLOR_HEBREW).find(([, v]) => v === c.name)?.[0] ?? c.name.toLowerCase();
          const isActive = activeColorWord ? swatchColor === activeColorWord : false;
          return (
            <span
              key={i}
              className={`catalog-card-color-dot${isActive ? " is-current" : ""}`}
              style={c.hex ? { background: c.hex } : undefined}
              title={c.name}
              aria-label={c.name}
            />
          );
        })}
      </div>
    </div>
  );
}

export function CarouselGrid({ items, autoplayMs, onOpenItem, onOpenTechSpecs }: CarouselGridProps) {
  const pages = useMemo(() => chunkItems(items, 4), [items]);
  const swiperKey = useMemo(() => items.map((item) => item.id).join("|"), [items]);
  const colorGroups = useMemo(() => buildItemColorGroups(items), [items]);
  const [swiperInstance, setSwiperInstance] = useState<SwiperType | null>(null);
  const [isBeginning, setIsBeginning] = useState(true);
  const [isEnd, setIsEnd] = useState(false);

  return (
    <section className="catalog-carousel" aria-label="קטלוג מוצרים">
      <button
        type="button"
        dir="ltr"
        className={`carousel-nav carousel-nav-prev${isBeginning && pages.length <= 1 ? " swiper-button-disabled" : ""}`}
        aria-label="עמוד קודם"
        onClick={() => swiperInstance?.slidePrev()}
      >
        <span className="carousel-nav-glyph">&#x2039;</span>
      </button>
      <button
        type="button"
        dir="ltr"
        className={`carousel-nav carousel-nav-next${isEnd && pages.length <= 1 ? " swiper-button-disabled" : ""}`}
        aria-label="עמוד הבא"
        onClick={() => swiperInstance?.slideNext()}
      >
        <span className="carousel-nav-glyph">&#x203A;</span>
      </button>
      <Swiper
        key={swiperKey}
        modules={[Pagination, Keyboard, A11y, Autoplay]}
        slidesPerView={1}
        initialSlide={0}
        speed={450}
        navigation={false}
        pagination={{ clickable: true }}
        keyboard={{ enabled: true, onlyInViewport: true }}
        a11y={{
          enabled: true,
          prevSlideMessage: "עמוד קודם",
          nextSlideMessage: "עמוד הבא",
        }}
        autoplay={{
          delay: autoplayMs,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        onSwiper={(s) => { setSwiperInstance(s); setIsBeginning(s.isBeginning); setIsEnd(s.isEnd); }}
        onSlideChange={(s) => { setIsBeginning(s.isBeginning); setIsEnd(s.isEnd); }}
      >
        {pages.map((page, pageIndex) => (
          <SwiperSlide key={`page-${pageIndex}`}>
            <div className="catalog-grid">
              {page.map((item) => (
                <article key={item.id} className="catalog-card">
                  <div className="catalog-card-body">
                    {extractCatalogNumber(item) && (
                      <div className="catalog-card-catalog">מספר קטלוגי: {extractCatalogNumber(item)}</div>
                    )}
                    <div className="catalog-card-main">
                      <div className="catalog-card-title">{item.title}</div>
                      {item.description && <div className="catalog-card-description">{item.description}</div>}
                    </div>
                    {item.sourceUrl && (
                      <button
                        className="catalog-card-tech-btn"
                        onClick={(e) => { e.stopPropagation(); onOpenTechSpecs(item); }}
                        aria-label={`נתונים טכניים עבור ${item.title}`}
                      >
                        <span>לנתונים טכנים</span>
                      </button>
                    )}
                  </div>
                  <div className="catalog-card-visual">
                    <div
                      className="catalog-card-image-wrap"
                      onMouseEnter={() => preloadAngleImages(item)}
                      onFocus={() => preloadAngleImages(item)}
                      onTouchStart={() => preloadAngleImages(item)}
                      onClick={() => onOpenItem(item)}
                      role="button"
                      tabIndex={0}
                      aria-label={`פתח זוויות מוצר ${item.title}`}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") onOpenItem(item);
                      }}
                    >
                      {item.coverImagePath ? (
                        <Image
                          src={trimmedProductSrc(item.coverImagePath)}
                          alt={item.title}
                          width={1200}
                          height={1200}
                          sizes="(max-width: 767px) 45vw, 22vw"
                          className="catalog-card-image"
                        />
                      ) : (
                        <div className="catalog-card-image-placeholder" aria-hidden="true" />
                      )}

                      {/* top: view angles */}
                      <button
                        className="catalog-card-cta catalog-card-cta--icon"
                        onMouseEnter={(e) => { e.stopPropagation(); preloadAngleImages(item); }}
                        onFocus={() => preloadAngleImages(item)}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onOpenItem(item); }}
                        aria-label={`הגדלה וזוויות נוספות עבור ${item.title}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/magnifier.png" alt="" aria-hidden="true" className="catalog-card-cta-icon" />
                      </button>

                      {/* bottom: color swatches */}
                      {colorGroups.has(item.id) && (
                        <CardColors
                          swatches={colorGroups.get(item.id)!}
                          activeColorWord={extractColorWord(item.title)}
                        />
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
