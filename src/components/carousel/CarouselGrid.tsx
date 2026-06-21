"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { A11y, Autoplay, Keyboard, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import { CarouselItem } from "@/lib/carousel/types";
import { buildModelSiblingSwatches, resolveItemSwatches, type ResolvedSwatch } from "@/lib/carousel/colors";
import { trimmedProductSrc, CARD_IMG_WIDTH, MODAL_IMG_WIDTH } from "@/lib/carousel/trim-src";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

type CarouselGridProps = {
  items: CarouselItem[];
  autoplayMs: number;
  onOpenItem: (item: CarouselItem) => void;
  onOpenTechSpecs: (item: CarouselItem) => void;
};

// Warm a card's first few angle images when the user signals open-intent
// (hover/touch). These are loaded at the MODAL width tier — the EXACT trim URL
// the product modal will request — so opening it paints from cache. The modal
// itself then warms the remaining angles and every other colour. Capped to keep
// the on-hover cost bounded (esp. on mobile touch).
function preloadAngleImages(item: CarouselItem) {
  if (typeof window === "undefined") return;
  const paths = (item.angles.length > 0
    ? item.angles.map((a) => a.imagePath)
    : [item.coverImagePath]
  )
    .filter((p): p is string => Boolean(p))
    .slice(0, 4);
  for (const path of paths) {
    const image = new window.Image();
    image.decoding = "async";
    image.src = trimmedProductSrc(path, MODAL_IMG_WIDTH);
  }
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

// One catalog card. Holds the locally-selected colour so clicking a swatch swaps
// the displayed image to that colour's re-hosted cover (scraped colours only).
function CatalogCard({
  item,
  swatches,
  onOpenItem,
  onOpenTechSpecs,
}: {
  item: CarouselItem;
  swatches: ResolvedSwatch[];
  onOpenItem: (item: CarouselItem) => void;
  onOpenTechSpecs: (item: CarouselItem) => void;
}) {
  const [colorImage, setColorImage] = useState<string | null>(null);
  const displayed = colorImage ?? item.coverImagePath;
  const catalog = extractCatalogNumber(item);

  return (
    <article className="catalog-card">
      <div className="catalog-card-body">
        {catalog && <div className="catalog-card-catalog">מספר קטלוגי: {catalog}</div>}
        <div className="catalog-card-main">
          <div className="catalog-card-title">{item.title}</div>
          {item.description && <div className="catalog-card-description">{item.description}</div>}
        </div>
        {item.sourceUrl && (
          <button
            className="catalog-card-tech-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenTechSpecs(item);
            }}
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
          {displayed ? (
            <Image
              src={trimmedProductSrc(displayed, CARD_IMG_WIDTH)}
              alt={item.title}
              width={CARD_IMG_WIDTH}
              height={CARD_IMG_WIDTH}
              unoptimized
              className="catalog-card-image"
            />
          ) : (
            <div className="catalog-card-image-placeholder" aria-hidden="true" />
          )}

          {/* top: view angles */}
          <button
            className="catalog-card-cta catalog-card-cta--icon"
            onMouseEnter={(e) => {
              e.stopPropagation();
              preloadAngleImages(item);
            }}
            onFocus={() => preloadAngleImages(item)}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onOpenItem(item);
            }}
            aria-label={`הגדלה וזוויות נוספות עבור ${item.title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/magnifier.png" alt="" aria-hidden="true" className="catalog-card-cta-icon" />
          </button>

          {/* bottom: colour swatches */}
          {swatches.length > 0 && (
            <div className="catalog-card-colors" dir="rtl">
              <span className="catalog-card-colors-label">צבעים</span>
              <div className="catalog-card-colors-dots">
                {swatches.map((swatch) => {
                  const actionable = Boolean(swatch.imagePath);
                  return (
                    <button
                      key={swatch.key}
                      type="button"
                      className={`catalog-card-color-dot${swatch.isCurrent ? " is-current" : ""}${actionable ? " is-actionable" : ""}`}
                      style={swatch.hex ? { background: swatch.hex } : undefined}
                      title={swatch.name}
                      aria-label={swatch.name}
                      aria-pressed={actionable ? colorImage === swatch.imagePath : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (swatch.imagePath) {
                          setColorImage((prev) => (prev === swatch.imagePath ? null : swatch.imagePath));
                        }
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function CarouselGrid({ items, autoplayMs, onOpenItem, onOpenTechSpecs }: CarouselGridProps) {
  const pages = useMemo(() => chunkItems(items, 4), [items]);
  const swiperKey = useMemo(() => items.map((item) => item.id).join("|"), [items]);
  const modelSiblings = useMemo(() => buildModelSiblingSwatches(items), [items]);
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
                <CatalogCard
                  key={item.id}
                  item={item}
                  swatches={resolveItemSwatches(item, modelSiblings.get(item.id))}
                  onOpenItem={onOpenItem}
                  onOpenTechSpecs={onOpenTechSpecs}
                />
              ))}
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
