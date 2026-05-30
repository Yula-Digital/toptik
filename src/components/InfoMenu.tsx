"use client";

import { useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { DOCS, DOC_ORDER, type DocId } from "@/content/legal-docs";

type Variant = "desktop" | "mobile";

type Props = {
  variant: Variant;
  // Mobile burger menu wants to close itself when an item is tapped.
  onItemSelect?: () => void;
};

export function InfoMenu({ variant, onItemSelect }: Props) {
  const [openId, setOpenId] = useState<DocId | null>(null);
  const [mounted, setMounted] = useState(false);

  const close = useCallback(() => setOpenId(null), []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openId, close]);

  const openDoc = (id: DocId) => {
    setOpenId(id);
    onItemSelect?.();
  };

  const linkClass =
    variant === "mobile" ? "m-menu-info-link" : "navbar-info-link";

  // Portal the modal to <body> so it escapes any ancestor with
  // transform / backdrop-filter / overflow:hidden — those would otherwise
  // re-root position:fixed and clip the modal mid-content.
  const modal =
    openId && mounted
      ? createPortal(
          <div
            className="info-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={DOCS[openId].title}
            onClick={close}
          >
            <div
              className="info-modal"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="info-modal-close"
                onClick={close}
                aria-label="סגור"
              >
                ✕
              </button>
              <h1 className="info-modal-title">{DOCS[openId].title}</h1>
              <div className="info-modal-body">{DOCS[openId].body}</div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {DOC_ORDER.map((id) => (
        <button
          key={id}
          type="button"
          className={linkClass}
          onClick={() => openDoc(id)}
        >
          {DOCS[id].title}
        </button>
      ))}
      {modal}
    </>
  );
}
