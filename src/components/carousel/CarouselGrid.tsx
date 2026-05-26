"use client";

import { useMemo } from "react";
import Image from "next/image";
import { A11y, Autoplay, Keyboard, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import magnifierIcon from "../../../images/images_from_mandarina/magnifaier_icon.svg";
import { CarouselItem } from "@/lib/carousel/types";

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

export function CarouselGrid({ items, autoplayMs, onOpenItem, onOpenTechSpecs }: CarouselGridProps) {
  const pages = useMemo(() => chunkItems(items, 4), [items]);
  const swiperKey = useMemo(() => items.map((item) => item.id).join("|"), [items]);

  return (
    <section className="catalog-carousel" aria-label="קטלוג מוצרים">
      <Swiper
        key={swiperKey}
        modules={[Navigation, Pagination, Keyboard, A11y, Autoplay]}
        slidesPerView={1}
        initialSlide={0}
        speed={450}
        navigation
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

                      {/* bottom: tech specs */}
                      {item.sourceUrl && (
                        <button
                          className="catalog-card-tech-btn"
                          onTouchStart={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); onOpenTechSpecs(item); }}
                          aria-label={`פרטים טכניים עבור ${item.title}`}
                        >
                          <span>לפרטים טכניים</span>
                        </button>
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
