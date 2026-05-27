"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import catalogButton from "../../../images/cataloge_bottun.svg";
import { ShatterTransition } from "@/components/carousel/ShatterTransition";
import { TransitionMode, CarouselPayload } from "@/lib/carousel/types";
import { trimmedProductSrc } from "@/lib/carousel/trim-src";

const catalogButtonUrl = typeof catalogButton === "string" ? catalogButton : catalogButton.src;

type HomeToCarouselCtaProps = {
  heroImageUrl: string;
};

export function HomeToCarouselCta({ heroImageUrl }: HomeToCarouselCtaProps) {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionMode, setTransitionMode] = useState<TransitionMode>("shatter-particle");

  useEffect(() => {
    let isMounted = true;

    async function loadAndPrewarm() {
      try {
        const res = await fetch("/api/carousel");
        if (!res.ok) return;
        const data = (await res.json()) as CarouselPayload;
        const apiMode = data?.settings?.transitionMode;
        if (isMounted && (apiMode === "shatter-particle" || apiMode === "curtain-fade")) {
          setTransitionMode(apiMode);
        }

        // Pre-warm tech-specs cache for any active item that doesn't already
        // have it stored. This runs entirely on the LANDING PAGE so that
        // by the time the visitor clicks "כניסה לגלריה" the carousel API
        // (and modal) returns instantly with everything cached.
        const coldUrls = (data?.items ?? [])
          .filter((it) => it.isActive && it.sourceUrl && !it.techSpecs)
          .map((it) => it.sourceUrl!);
        if (coldUrls.length > 0) {
          void Promise.all(
            coldUrls.map((url) =>
              fetch(`/api/product-details?url=${encodeURIComponent(url)}`).catch(() => {}),
            ),
          );
        }

        // Also prefetch the trimmed cover images. The browser warms the
        // Next/Image optimizer cache so the carousel grid pops instantly.
        for (const item of data?.items ?? []) {
          if (!item.isActive || !item.coverImagePath) continue;
          const src = trimmedProductSrc(item.coverImagePath);
          const link = document.createElement("link");
          link.rel = "prefetch";
          link.as = "image";
          link.href = `/_next/image?url=${encodeURIComponent(src)}&w=640&q=85`;
          link.fetchPriority = "low";
          document.head.appendChild(link);
        }
      } catch {
        // keep default transition mode on network error
      }
    }

    void loadAndPrewarm();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <button
        className="enter-catalog-btn"
        style={{ backgroundImage: `url(${catalogButtonUrl})` }}
        onClick={() => setIsTransitioning(true)}
        disabled={isTransitioning}
        aria-label="כניסה לגלריה"
      >
        <span className="catalog-svg-btn-text">כניסה לגלריה</span>
      </button>

      {isTransitioning && (
        <ShatterTransition
          imageUrl={heroImageUrl}
          mode={transitionMode}
          onComplete={() => {
            router.push("/carousel");
          }}
        />
      )}
    </>
  );
}
