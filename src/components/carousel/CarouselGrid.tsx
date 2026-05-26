"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Image from "next/image";
import { A11y, Autoplay, Keyboard, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import magnifierIcon from "../../../images/images_from_mandarina/magnifaier_icon.svg";
import { CarouselItem } from "@/lib/carousel/types";
import type { ColorSwatch } from "@/lib/catalog-source/product-details";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

type CarouselGridProps = {
  items: CarouselItem[];
  autoplayMs: number;
  onOpenItem: (item: CarouselItem) => void;
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

// Match colour name against title (Hebrew + English keywords).
// Returns the index of the colour swatch that matches the product variant
// being shown, or -1 if no match found.
function findActiveColorIndex(colors: ColorSwatch[], productTitle: string): number {
  if (colors.length === 0) return -1;
  const titleLower = productTitle.toLowerCase();
  for (let i = 0; i < colors.length; i++) {
    const name = colors[i].name.toLowerCase();
    if (name && titleLower.includes(name)) return i;
  }
  return -1;
}

// Lazy-loads color swatches when the card scrolls into view
function CardColors({ sourceUrl, productTitle }: { sourceUrl: string; productTitle: string }) {
  const [colors, setColors] = useState<ColorSwatch[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        fetch(`/api/product-details?url=${encodeURIComponent(sourceUrl)}`)
          .then((r) => r.json())
          .then((d: { colors?: ColorSwatch[] }) => {
            if (d.colors?.length) setColors(d.colors);
          })
          .catch(() => {});
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sourceUrl]);

  if (colors.length === 0) {
    return <div ref={containerRef} className="catalog-card-colors-anchor" aria-hidden="true" />;
  }

  const activeIndex = findActiveColorIndex(colors, productTitle);

  return (
    <div ref={containerRef} className="catalog-card-colors" dir="rtl">
      <span className="catalog-card-colors-label">צבעים</span>
      <div className="catalog-card-colors-dots">
        {colors.map((c, i) => (
          <span
            key={i}
            className={`catalog-card-color-dot${i === activeIndex ? " is-current" : ""}`}
            style={c.hex ? { background: c.hex } : undefined}
            title={c.name}
            aria-label={c.name}
          />
        ))}
      </div>
    </div>
  );
}

export function CarouselGrid({ items, autoplayMs, onOpenItem, onOpenTechSpecs }: CarouselGridProps) {
  const pages = useMemo(() => chunkItems(items, 4), [items]);
  const swiperKey = useMemo(() => items.map((item) => item.id).join("|"), [items]);

  return (
    <section className="catalog-carousel" aria-label="קטלוג מוצרים">
      <button type="button" dir="ltr" className="carousel-nav carousel-nav-prev" aria-label="עמוד קודם">
        <span className="carousel-nav-glyph">&#x2039;</span>
      </button>
      <button type="button" dir="ltr" className="carousel-nav carousel-nav-next" aria-label="עמוד הבא">
        <span className="carousel-nav-glyph">&#x203A;</span>
      </button>
      <Swiper
        key={swiperKey}
        modules={[Navigation, Pagination, Keyboard, A11y, Autoplay]}
        slidesPerView={1}
        initialSlide={0}
        speed={450}
        navigation={{ prevEl: ".carousel-nav-prev", nextEl: ".carousel-nav-next" }}
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
                          src={item.coverImagePath}
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
                        className="catalog-card-cta"
                        onMouseEnter={(e) => { e.stopPropagation(); preloadAngleImages(item); }}
                        onFocus={() => preloadAngleImages(item)}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onOpenItem(item); }}
                        aria-label={`הגדלה וזוויות נוספות עבור ${item.title}`}
                      >
                        <Image src={magnifierIcon} alt="" aria-hidden="true" className="catalog-card-cta-icon" />
                        <span>להגדלה וזוויות נוספות</span>
                      </button>

                      {/* bottom: color swatches */}
                      {item.sourceUrl && <CardColors sourceUrl={item.sourceUrl} productTitle={item.title} />}
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
