"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import carouselTexture from "../../../images/carusell/carucell_backgrownd.svg";
import { CarouselGrid } from "@/components/carousel/CarouselGrid";
import { ProductModal } from "@/components/carousel/ProductModal";
import { TechSpecsModal } from "@/components/carousel/TechSpecsModal";
import { CarouselItem, CarouselPayload } from "@/lib/carousel/types";
import { fallbackCarouselPayload } from "@/lib/carousel/fallback-data";

export default function CarouselPageClient() {
  const [payload, setPayload] = useState<CarouselPayload>(fallbackCarouselPayload);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<CarouselItem | null>(null);
  const [activeAngleIndex, setActiveAngleIndex] = useState(0);
  const [techSpecsItem, setTechSpecsItem] = useState<CarouselItem | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/carousel", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch carousel payload");
        return res.json();
      })
      .then((data) => setPayload(data))
      .catch((error) => {
        console.warn("Using fallback carousel payload", error);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, []);

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

  const carouselSurfaceStyle = useMemo(
    () =>
      ({
        ["--carousel-bg-url" as string]: `url(${carouselTexture.src})`,
      }) as CSSProperties,
    [],
  );

  return (
    <main className="carousel-page" style={carouselSurfaceStyle}>
      <header className="carousel-header">
        <h1>קטלוג TOPTIK</h1>
        <div className="carousel-header-actions">
          <Link className="carousel-back-link" href="/">
            חזרה לדף הבית
          </Link>
          <Link className="carousel-admin-link" href="/admin">
            אדמין
          </Link>
        </div>
      </header>

      {isLoading ? (
        <div className="carousel-loading">טוען מוצרים...</div>
      ) : (
        <CarouselGrid items={activeItems} autoplayMs={payload.settings.autoplayMs} onOpenItem={onOpenItem} onOpenTechSpecs={onOpenTechSpecs} />
      )}

      <ProductModal
        item={selectedItem}
        activeAngleIndex={activeAngleIndex}
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
