"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CarouselGrid } from "@/components/carousel/CarouselGrid";
import { CategoryNav } from "@/components/carousel/CategoryNav";
import { ProductModal } from "@/components/carousel/ProductModal";
import { TechSpecsModal } from "@/components/carousel/TechSpecsModal";
import { CarouselItem, CarouselPayload } from "@/lib/carousel/types";
import { fallbackCarouselPayload } from "@/lib/carousel/fallback-data";
import { buildItemColorGroups } from "@/lib/carousel/color-groups";
import {
  CategoryKey,
  filterByCategory,
  parseCategoryParam,
} from "@/lib/carousel/categories";

export default function CarouselPageClient() {
  const [payload, setPayload] = useState<CarouselPayload>(fallbackCarouselPayload);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<CarouselItem | null>(null);
  const [activeAngleIndex, setActiveAngleIndex] = useState(0);
  const [techSpecsItem, setTechSpecsItem] = useState<CarouselItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>(() => {
    if (typeof window === "undefined") return "all";
    const param = new URL(window.location.href).searchParams.get("category");
    return parseCategoryParam(param);
  });

  const onChangeCategory = useCallback((key: CategoryKey) => {
    setActiveCategory(key);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (key === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", key);
    window.history.replaceState({}, "", url.toString());
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/carousel", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch carousel payload");
        return res.json();
      })
      .then((data: CarouselPayload) => {
        setPayload(data);
        // Fallback warming: most visitors arrive via the landing page which
        // already pre-warms. This catches deep-link visits to /carousel.
        const cold = data.items
          .filter((it) => it.isActive && it.sourceUrl && !it.techSpecs)
          .map((it) => it.sourceUrl!);
        if (cold.length > 0) {
          void Promise.all(
            cold.map((url) =>
              fetch(`/api/product-details?url=${encodeURIComponent(url)}`, {
                signal: controller.signal,
              }).catch(() => {}),
            ),
          );
        }
      })
      .catch((error) => {
        console.warn("Using fallback carousel payload", error);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, []);

  const colorGroups = useMemo(() => buildItemColorGroups(payload.items.filter(i => i.isActive)), [payload.items]);

  const activeItems = useMemo(() => {
    const deduped = new Map<string, CarouselItem>();
    payload.items
      .filter((item) => item.isActive)
      .sort(
        (a, b) =>
          a.displayOrder - b.displayOrder ||
          (a.catalogNumber ?? "").localeCompare(b.catalogNumber ?? "") ||
          a.title.localeCompare(b.title),
      )
      .forEach((item) => {
        const catalogKey = item.catalogNumber?.trim().toLowerCase();
        const signature =
          catalogKey && catalogKey.length > 0
            ? `catalog:${catalogKey}`
            : `${item.title.trim().toLowerCase()}|${item.coverImagePath.trim().toLowerCase()}`;
        const current = deduped.get(signature);
        if (!current) {
          deduped.set(signature, item);
          return;
        }

        // Prefer the richer record so imported multi-angle products win over stale single-angle duplicates.
        const currentAngleCount = current.angles.length;
        const nextAngleCount = item.angles.length;
        if (nextAngleCount > currentAngleCount) {
          deduped.set(signature, item);
        }
      });
    return [...deduped.values()];
  }, [payload.items]);

  const onOpenItem = useCallback((item: CarouselItem) => {
    const orderedAngles = [...item.angles].sort((a, b) => a.angleOrder - b.angleOrder);
    setSelectedItem({ ...item, angles: orderedAngles });
    setActiveAngleIndex(0);
  }, []);

  const onCloseModal = useCallback(() => setSelectedItem(null), []);
  const onOpenTechSpecs = useCallback((item: CarouselItem) => setTechSpecsItem(item), []);
  const onCloseTechSpecs = useCallback(() => setTechSpecsItem(null), []);

  const onNextAngle = useCallback(() => {
    if (!selectedItem) return;
    setActiveAngleIndex((current) => (current + 1) % selectedItem.angles.length);
  }, [selectedItem]);

  const onPrevAngle = useCallback(() => {
    if (!selectedItem) return;
    setActiveAngleIndex((current) => (current - 1 + selectedItem.angles.length) % selectedItem.angles.length);
  }, [selectedItem]);

  const visibleItems = useMemo(
    () => filterByCategory(activeItems, activeCategory),
    [activeItems, activeCategory],
  );

  const carouselSurfaceStyle = useMemo(
    () =>
      ({
        ["--carousel-bg-url" as string]: `url(/carousel-texture.webp)`,
      }) as CSSProperties,
    [],
  );

  return (
    <main className="carousel-page" style={carouselSurfaceStyle}>
      <Link
        href="/admin"
        className="carousel-admin-secret-zone"
        aria-label="כניסת אדמין"
      />
      <header className="carousel-header">
        <h1>קטלוג TOPTIK</h1>
        <div className="carousel-header-actions">
          <Link className="carousel-back-link" href="/">
            חזרה לדף הבית
          </Link>
        </div>
      </header>

      {isLoading ? (
        <div className="carousel-loading">טוען מוצרים...</div>
      ) : (
        <div className="carousel-page-body" dir="rtl">
          <CategoryNav active={activeCategory} onChange={onChangeCategory} />
          <CarouselGrid
            items={visibleItems}
            autoplayMs={payload.settings.autoplayMs}
            onOpenItem={onOpenItem}
            onOpenTechSpecs={onOpenTechSpecs}
          />
        </div>
      )}

      <ProductModal
        item={selectedItem}
        activeAngleIndex={activeAngleIndex}
        colors={selectedItem ? (colorGroups.get(selectedItem.id) ?? []) : []}
        onClose={onCloseModal}
        onNextAngle={onNextAngle}
        onPrevAngle={onPrevAngle}
        onSelectAngle={setActiveAngleIndex}
        onOpenTechSpecs={onOpenTechSpecs}
      />

      <TechSpecsModal item={techSpecsItem} onClose={onCloseTechSpecs} />
    </main>
  );
}
