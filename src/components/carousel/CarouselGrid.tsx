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

const COLOR_MAP: Record<string, string> = {
  black: "#1a1a1a",
  graphite: "#4a4a4a",
  steel: "#71797E",
  "dress blue": "#1f3a5f",
  taupe: "#8b7d6b",
  moire: "#5e6b5e",
  "duck yellow": "#f2c94c",
  yellow: "#f2c94c",
  "flame scarlet": "#cf2f3b",
  eclipse: "#3b3b3b",
  titanium: "#9a9a9a",
  "military olive": "#4b5320",
  "colony blue": "#6b93a5",
  "honey ginger": "#b5651d",
  white: "#f5f5f5",
  red: "#d32f2f",
  blue: "#1565c0",
  green: "#388e3c",
  grey: "#757575",
  gray: "#757575",
  brown: "#5d4037",
  beige: "#d4c5a9",
  navy: "#1a237e",
  cream: "#fffdd0",
  orange: "#e65100",
  pink: "#c2185b",
  purple: "#6a1b9a",
  "dark blue": "#0d47a1",
  "light grey": "#bdbdbd",
  "light gray": "#bdbdbd",
};

function getColorHex(colorName: string): string {
  const lower = colorName.toLowerCase().trim();
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  for (const [key, value] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return value;
  }
  return "#ccc";
}

type CarouselGridProps = {
  items: CarouselItem[];
  autoplayMs: number;
  onOpenItem: (item: CarouselItem) => void;
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

export function CarouselGrid({ items, autoplayMs, onOpenItem }: CarouselGridProps) {
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
                      <Image
                        src={item.coverImagePath}
                        alt={item.title}
                        width={1200}
                        height={1200}
                        sizes="(max-width: 767px) 45vw, 22vw"
                        className="catalog-card-image"
                      />
                    </div>
                    {(item.availableColors?.length || item.dimensions || item.sizes?.length) && (
                      <div className="catalog-card-specs">
                        {item.availableColors && item.availableColors.length > 0 && (
                          <div className="catalog-spec-block">
                            <h4 className="catalog-spec-heading">צבעים</h4>
                            <div className="catalog-spec-colors">
                              {item.availableColors.map((color) => (
                                <span
                                  key={color}
                                  className={`catalog-color-dot${item.color?.toLowerCase() === color.toLowerCase() ? " is-current" : ""}`}
                                  title={color}
                                  aria-label={color}
                                  style={{ backgroundColor: getColorHex(color) }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {item.dimensions && (
                          <div className="catalog-spec-block">
                            <h4 className="catalog-spec-heading">מידות</h4>
                            <div className="catalog-spec-dims">{item.dimensions}</div>
                          </div>
                        )}
                        {item.sizes && item.sizes.length > 0 && (
                          <div className="catalog-spec-block">
                            <div className="catalog-spec-sizes">
                              {item.sizes.map((size) => {
                                const isCurrent = size.startsWith("*");
                                const label = isCurrent ? size.slice(1) : size;
                                return (
                                  <span key={size} className={`catalog-size-chip${isCurrent ? " is-current" : ""}`}>
                                    {label}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      className="catalog-card-cta"
                      onMouseEnter={() => preloadAngleImages(item)}
                      onFocus={() => preloadAngleImages(item)}
                      onTouchStart={() => preloadAngleImages(item)}
                      onClick={() => onOpenItem(item)}
                      aria-label={`הגדלה וזוויות נוספות עבור ${item.title}`}
                    >
                      <Image src={magnifierIcon} alt="" aria-hidden="true" className="catalog-card-cta-icon" />
                      <span>להגדלה וזוויות נוספות</span>
                    </button>
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
