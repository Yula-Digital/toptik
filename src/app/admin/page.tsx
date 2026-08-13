"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CarouselPayload, TransitionMode } from "@/lib/carousel/types";
import { fallbackCarouselPayload } from "@/lib/carousel/fallback-data";
import { detectVendorFromCatalog, normalizeCatalogKey } from "@/lib/catalog-source/vendor-detect";

const STORAGE_KEY = "toptik_admin_token";
const BATCH_IMPORT_INITIAL = 5;
const BATCH_IMPORT_INCREMENT = 5;
type Vendor = "mandarina" | "brics";
const VENDOR_OPTIONS: Array<{ value: Vendor; label: string; example: string }> = [
  { value: "mandarina", label: "Mandarina Duck", example: "P10QMC01-465-TU" },
  { value: "brics", label: "Bric's", example: "BOE58117.050" },
];
type ImportFeedbackTone = "info" | "success" | "error";
type ImportPreview = {
  id: string;
  title: string;
  coverImagePath: string;
  catalogNumber: string;
};
type ImportedItemData = {
  item: CarouselPayload["items"][number];
  source: { catalogNumber: string; importedImages: number };
};
type BatchImportStatus = {
  tone: ImportFeedbackTone;
  message: string;
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [payload, setPayload] = useState<CarouselPayload>(fallbackCarouselPayload);
  const [status, setStatus] = useState<string>("טוען...");
  const [isSaving, setIsSaving] = useState(false);
  const [batchCatalogInputs, setBatchCatalogInputs] = useState<Record<Vendor, string[]>>({
    mandarina: Array.from({ length: BATCH_IMPORT_INITIAL }, () => ""),
    brics: Array.from({ length: BATCH_IMPORT_INITIAL }, () => ""),
  });
  const [batchImportStatuses, setBatchImportStatuses] = useState<
    Record<Vendor, Record<number, BatchImportStatus>>
  >({ mandarina: {}, brics: {} });
  const [batchImportingVendor, setBatchImportingVendor] = useState<Vendor | null>(null);
  const isBatchImporting = batchImportingVendor !== null;
  const [urlImportValue, setUrlImportValue] = useState("");
  const [isUrlImporting, setIsUrlImporting] = useState(false);
  const [urlImportStatus, setUrlImportStatus] = useState<BatchImportStatus | null>(null);
  const [itemCatalogInputs, setItemCatalogInputs] = useState<Record<string, string>>({});
  const [itemVendorMap, setItemVendorMap] = useState<Record<string, Vendor>>({});
  const [itemImportingMap, setItemImportingMap] = useState<Record<string, boolean>>({});
  const [importFeedback, setImportFeedback] = useState<{
    tone: ImportFeedbackTone;
    message: string;
  } | null>(null);
  const [importPreviews, setImportPreviews] = useState<ImportPreview[]>([]);
  // Catalog numbers that failed to import, kept AFTER the import run so the admin
  // can review/copy them. A catalog is removed once it later imports OK.
  const [failedImports, setFailedImports] = useState<Array<{ catalog: string; reason: string }>>([]);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Persist the failed list across page reloads (until every catalog is imported
  // OK — which empties + clears it — or the admin clears it manually). State
  // starts empty to match SSR; localStorage is read after mount to avoid a
  // hydration mismatch, and the first save is skipped so the load isn't wiped.
  const FAILED_STORAGE_KEY = "toptik_failed_imports";
  const firstFailedSaveRef = useRef(true);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAILED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setFailedImports(parsed);
      }
    } catch {
      // ignore malformed storage
    }
  }, []);
  useEffect(() => {
    if (firstFailedSaveRef.current) {
      firstFailedSaveRef.current = false;
      return;
    }
    try {
      if (failedImports.length > 0) {
        window.localStorage.setItem(FAILED_STORAGE_KEY, JSON.stringify(failedImports));
      } else {
        window.localStorage.removeItem(FAILED_STORAGE_KEY);
      }
    } catch {
      // ignore quota/security errors
    }
  }, [failedImports]);

  // Merge a batch of results into the persistent failed list: drop catalogs that
  // succeeded this round, add/replace the ones that failed.
  function recordImportResults(
    succeeded: string[],
    failed: Array<{ catalog: string; reason: string }>,
  ) {
    setFailedImports((prev) => {
      const byKey = new Map(prev.map((f) => [normalizeCatalogKey(f.catalog), f]));
      for (const c of succeeded) byKey.delete(normalizeCatalogKey(c));
      for (const f of failed) byKey.set(normalizeCatalogKey(f.catalog), f);
      return [...byKey.values()];
    });
  }

  async function copyToClipboard(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      setImportFeedback({ tone: "error", message: "ההעתקה נכשלה — העתק ידנית." });
    }
  }

  function resolveErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }

  function normalizeCatalogNumber(value: string) {
    return value.trim().toUpperCase();
  }

  function upsertImportedItem(
    current: CarouselPayload,
    data: ImportedItemData,
    targetItemId?: string,
  ) {
    const next = structuredClone(current);
    const normalizedCatalog = normalizeCatalogNumber(data.source.catalogNumber);
    // Match an existing row ONLY by exact (separator-insensitive) catalog
    // number. Matching by title used to silently MERGE distinct colour SKUs
    // that share a title (e.g. three "Taormina Expandable Checked" colours),
    // so only one card survived and the rest vanished with a false "success".
    // Each distinct catalog number now becomes its own card.
    const sourceKey = normalizeCatalogKey(normalizedCatalog);
    const existingIndex = targetItemId
      ? next.items.findIndex((item) => item.id === targetItemId)
      : next.items.findIndex(
          (item) => sourceKey !== "" && normalizeCatalogKey(item.catalogNumber ?? "") === sourceKey,
        );

    if (existingIndex >= 0) {
      const existing = next.items[existingIndex];
      // Re-import overwrites with the fresh scrape but keeps the row's id,
      // display order and active flag.
      next.items[existingIndex] = {
        ...data.item,
        id: existing.id,
        displayOrder: existing.displayOrder,
        isActive: existing.isActive,
        techSpecs: data.item.techSpecs ?? existing.techSpecs,
        colors: data.item.colors ?? existing.colors,
        angles: data.item.angles.map((angle) => ({
          ...angle,
          itemId: existing.id,
        })),
      };
      return { next, mode: "updated" as const };
    }

    const maxOrder = next.items.reduce((max, item) => Math.max(max, item.displayOrder), 0);
    next.items.push({
      ...data.item,
      displayOrder: maxOrder + 1,
    });
    return { next, mode: "created" as const };
  }

  function vendorForItem(item: CarouselPayload["items"][number]): Vendor {
    const explicit = itemVendorMap[item.id];
    if (explicit) return explicit;
    return item.sourceUrl?.includes("bricstore") ? "brics" : "mandarina";
  }

  function vendorLabel(vendor: Vendor) {
    return VENDOR_OPTIONS.find((option) => option.value === vendor)?.label ?? vendor;
  }

  function isUrlValue(value: string) {
    return /^https?:\/\//i.test(value.trim());
  }

  // A batch/Excel row may be a catalog number OR a full product URL. URLs must
  // keep their exact case (paths are case-sensitive); catalogs are uppercased.
  function normalizeRowValue(value: string) {
    return isUrlValue(value) ? value.trim() : value.trim().toUpperCase();
  }

  async function importByUrlFromSource(url: string, targetItemId?: string): Promise<ImportedItemData> {
    const res = await fetch("/api/admin/import/by-url", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ url, targetItemId }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error || "Import failed");
    }
    return (await res.json()) as ImportedItemData;
  }

  async function importCatalogNumberFromSource(
    vendor: Vendor,
    activeCatalogNumber: string,
    targetItemId?: string,
  ): Promise<ImportedItemData> {
    const res = await fetch(`/api/admin/import/${vendor}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify({ catalogNumber: activeCatalogNumber, targetItemId }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error || "Import failed");
    }
    return (await res.json()) as ImportedItemData;
  }

  async function persistPayload(nextPayload: CarouselPayload) {
    const res = await fetch("/api/admin/carousel", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify(nextPayload),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error || "Save failed");
    }
  }

  const loadData = useCallback(async (activeToken: string) => {
    try {
      setStatus("טוען נתוני אדמין...");
      const res = await fetch("/api/admin/carousel", {
        headers: { "x-admin-token": activeToken },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Unauthorized or load failed");
      }
      const data = await res.json();
      setPayload(data);
      setStatus("מחובר");
      setAuthReady(true);
    } catch (error) {
      setStatus(resolveErrorMessage(error, "טוקן לא תקין או חוסר הרשאות"));
      setAuthReady(false);
    }
  }, []);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(STORAGE_KEY) || "";
    setToken(savedToken);
    setAuthReady(Boolean(savedToken));
    if (!savedToken) {
      setStatus("הזן טוקן אדמין כדי להתחבר");
      return;
    }
    void loadData(savedToken);
  }, [loadData]);

  function updateItemField(
    index: number,
    field: "title" | "description" | "catalogNumber" | "displayOrder" | "isActive",
    value: string | number | boolean,
  ) {
    setPayload((current) => {
      const next = structuredClone(current);
      const item = next.items[index];
      if (field === "displayOrder") item.displayOrder = Number(value);
      else if (field === "isActive") item.isActive = Boolean(value);
      else if (field === "catalogNumber") {
        const normalized = String(value).trim();
        item.catalogNumber = normalized ? normalized : null;
      }
      else if (field === "description") item.description = String(value);
      else item.title = String(value);
      return next;
    });
  }

  function addItem() {
    setPayload((current) => {
      const next = structuredClone(current);
      const itemId = crypto.randomUUID();
      next.items.push({
        id: itemId,
        title: "מוצר חדש",
        description: "",
        catalogNumber: null,
        sourceUrl: null,
        coverImagePath: "/hero-web-airport.png",
        displayOrder: next.items.length + 1,
        isActive: true,
        angles: [
          {
            id: crypto.randomUUID(),
            itemId,
            angleKey: "front",
            imagePath: "/hero-web-airport.png",
            angleOrder: 1,
          },
        ],
      });
      return next;
    });
  }

  function removeItem(itemId: string) {
    setPayload((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId),
    }));
  }

  async function uploadFile(file: File, folder: string): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);
    const res = await fetch("/api/admin/upload", {
      method: "POST",
      headers: { "x-admin-token": token },
      body: formData,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error || "Upload failed");
    }
    const data = await res.json();
    return data.publicUrl as string;
  }

  async function onCoverUpload(itemIndex: number, file: File) {
    try {
      setStatus("מעלה cover...");
      const item = payload.items[itemIndex];
      const url = await uploadFile(file, `items/${item.id}/cover`);
      setPayload((current) => {
        const next = structuredClone(current);
        next.items[itemIndex].coverImagePath = url;
        return next;
      });
      setStatus("cover הועלה");
    } catch (error) {
      setStatus(resolveErrorMessage(error, "שגיאת העלאה"));
    }
  }

  async function onExportExcel() {
    try {
      setStatus("מכין קובץ אקסל...");
      const XLSX = await import("xlsx");
      const rows = [...payload.items]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((item) => ({
          "מק״ט": item.catalogNumber ?? "",
          "שם המוצר": item.title,
        }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [{ wch: 18 }, { wch: 60 }];
      const workbook = XLSX.utils.book_new();
      workbook.Workbook = { Views: [{ RTL: true }] };
      XLSX.utils.book_append_sheet(workbook, worksheet, "מוצרים");
      XLSX.writeFile(workbook, "toptik-products.xlsx");
      setStatus(`קובץ אקסל ירד (${rows.length} מוצרים)`);
    } catch (error) {
      setStatus(resolveErrorMessage(error, "שגיאה ביצירת קובץ האקסל"));
    }
  }

  async function onSave() {
    try {
      setIsSaving(true);
      setStatus("שומר...");
      await persistPayload(payload);
      setStatus("נשמר בהצלחה");
      setImportFeedback({
        tone: "success",
        message: "השינויים נשמרו בהצלחה.",
      });
    } catch (error) {
      setStatus(resolveErrorMessage(error, "שגיאת שמירה"));
      setImportFeedback({
        tone: "error",
        message: resolveErrorMessage(error, "שגיאת שמירה"),
      });
    } finally {
      setIsSaving(false);
    }
  }

  // Load catalog numbers from an uploaded Excel file into a vendor's batch
  // grid. Expected layout: first row = column header, every row below it = one
  // catalog number in the first column. Nothing is imported yet — the user
  // reviews the filled grid and clicks "ייבא ושמור הכל".
  async function onExcelUpload(vendor: Vendor, file: File) {
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("קובץ האקסל ריק");

      // raw:false returns the DISPLAYED cell text, so numeric-looking catalog
      // numbers (e.g. 58117.050) keep their exact formatting.
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        blankrows: false,
      });
      const catalogNumbers = rows
        .slice(1) // first row is the column header
        .map((row) => String(row?.[0] ?? "").trim())
        .filter(Boolean);

      if (catalogNumbers.length === 0) {
        throw new Error('לא נמצאו מק״טים בקובץ (שורה ראשונה = כותרת עמודה, מתחתיה מק״טים בעמודה הראשונה)');
      }

      // Dedupe on the separator-insensitive key, keep the first-seen spelling.
      // Rows may be catalog numbers or full product URLs (URLs keep their case).
      const seenKeys = new Set<string>();
      const unique: string[] = [];
      for (const value of catalogNumbers) {
        const key = normalizeCatalogKey(value);
        if (!key || seenKeys.has(key)) continue;
        seenKeys.add(key);
        unique.push(normalizeRowValue(value));
      }
      const MAX_BATCH_ROWS = 80; // the catalog payload is capped at 80 items
      const loaded = unique.slice(0, MAX_BATCH_ROWS);
      const padded =
        loaded.length < BATCH_IMPORT_INITIAL
          ? [...loaded, ...Array.from({ length: BATCH_IMPORT_INITIAL - loaded.length }, () => "")]
          : loaded;

      setBatchCatalogInputs((current) => ({ ...current, [vendor]: padded }));
      setVendorBatchStatuses(vendor, () => ({}));

      const notes: string[] = [];
      const duplicateCount = catalogNumbers.length - unique.length;
      if (duplicateCount > 0) notes.push(`${duplicateCount} כפולים הוסרו`);
      if (unique.length > MAX_BATCH_ROWS) notes.push(`נחתכו ${unique.length - MAX_BATCH_ROWS} מעבר לתקרה של ${MAX_BATCH_ROWS}`);
      setImportFeedback({
        tone: "info",
        message: `נטענו ${loaded.length} מק״טים מהקובץ לסקשן ${vendorLabel(vendor)}${notes.length ? ` (${notes.join(", ")})` : ""}. בדוק את הרשימה ולחץ "ייבא ושמור הכל".`,
      });
    } catch (error) {
      setImportFeedback({
        tone: "error",
        message: resolveErrorMessage(error, "שגיאה בקריאת קובץ האקסל"),
      });
    }
  }

  function setVendorBatchStatuses(
    vendor: Vendor,
    updater: (current: Record<number, BatchImportStatus>) => Record<number, BatchImportStatus>,
  ) {
    setBatchImportStatuses((current) => ({
      ...current,
      [vendor]: updater(current[vendor]),
    }));
  }

  // Import a product straight from a product-page URL (supported sources:
  // mandarinaduck.com / bricstore.com / huntleather.com / amazon). Imports and
  // saves in one action, like the batch flow.
  async function onImportByUrl() {
    const url = urlImportValue.trim();
    if (!url) {
      setUrlImportStatus({ tone: "error", message: "יש להדביק כתובת של עמוד מוצר." });
      return;
    }

    try {
      setIsUrlImporting(true);
      setUrlImportStatus({ tone: "info", message: "מייבא מהכתובת... זה עשוי לקחת עד דקה-שתיים." });
      setImportFeedback(null);

      const res = await fetch("/api/admin/import/by-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Import failed");
      }
      const data = (await res.json()) as ImportedItemData;

      const result = upsertImportedItem(payload, data);
      await persistPayload(result.next);
      setPayload(result.next);
      setImportPreviews((current) =>
        [
          {
            id: crypto.randomUUID(),
            title: data.item.title,
            coverImagePath: data.item.coverImagePath,
            catalogNumber: data.source.catalogNumber,
          },
          ...current,
        ].slice(0, 8),
      );
      setUrlImportValue("");
      const successMessage = `✅ הצלחה — ${result.mode === "updated" ? "עודכן מוצר קיים" : "נוצר מוצר חדש"} ונשמר: ${data.item.title} (מק״ט ${data.source.catalogNumber}, ${data.source.importedImages} תמונות).`;
      setUrlImportStatus({ tone: "success", message: successMessage });
      setImportFeedback({ tone: "success", message: successMessage });
    } catch (error) {
      const failureMessage = `❌ כישלון — ${resolveErrorMessage(error, "שגיאת ייבוא מכתובת")}`;
      setUrlImportStatus({ tone: "error", message: failureMessage });
      setImportFeedback({ tone: "error", message: failureMessage });
    } finally {
      setIsUrlImporting(false);
    }
  }

  async function onImportIntoItem(itemId: string) {
    const item = payload.items.find((row) => row.id === itemId);
    if (!item) return;
    const itemCatalogNumber = normalizeCatalogNumber(itemCatalogInputs[itemId] || "");
    if (!itemCatalogNumber) {
      setImportFeedback({ tone: "error", message: "יש להזין מספר קטלוגי ליבוא למוצר זה." });
      return;
    }
    // The typed catalog number decides the vendor (the select is a hint only).
    const vendor = detectVendorFromCatalog(itemCatalogNumber);

    try {
      setItemImportingMap((current) => ({ ...current, [itemId]: true }));
      setImportFeedback({
        tone: "info",
        message: `מייבא ${itemCatalogNumber} מ-${vendorLabel(vendor)} למוצר זה...`,
      });
      const data = await importCatalogNumberFromSource(vendor, itemCatalogNumber, itemId);
      setPayload((current) => upsertImportedItem(current, data, itemId).next);
      setItemCatalogInputs((current) => ({ ...current, [itemId]: "" }));
      recordImportResults([itemCatalogNumber], []);
      setImportFeedback({
        tone: "success",
        message: `עודכן מוצר (${data.source.catalogNumber}) עם ${data.source.importedImages} תמונות. לחץ "שמור הכל" לקיבוע.`,
      });
    } catch (error) {
      const reason = resolveErrorMessage(error, "שגיאת ייבוא למוצר");
      recordImportResults([], [{ catalog: itemCatalogNumber, reason }]);
      setImportFeedback({ tone: "error", message: reason });
    } finally {
      setItemImportingMap((current) => ({ ...current, [itemId]: false }));
    }
  }

  async function onBatchImportAndSave(vendor: Vendor) {
    const normalizedRows = batchCatalogInputs[vendor].map((value, index) => ({
      index,
      catalogNumber: normalizeRowValue(value),
    }));
    const filledRows = normalizedRows.filter((row) => row.catalogNumber);
    const nextStatuses: Record<number, BatchImportStatus> = {};

    if (filledRows.length === 0) {
      setVendorBatchStatuses(vendor, () => ({
        0: { tone: "error", message: "יש להזין לפחות מק״ט אחד." },
      }));
      return;
    }

    const seen = new Map<string, number>();
    for (const row of filledRows) {
      // Duplicate detection ignores separators: BXL58117.101 == BXL58117101.
      const key = normalizeCatalogKey(row.catalogNumber);
      const firstIndex = seen.get(key);
      if (firstIndex !== undefined) {
        nextStatuses[row.index] = { tone: "error", message: `מק״ט כפול בשורה ${firstIndex + 1}` };
        nextStatuses[firstIndex] = { tone: "error", message: `מק״ט כפול בשורה ${row.index + 1}` };
      } else {
        seen.set(key, row.index);
      }
    }

    if (Object.keys(nextStatuses).length > 0) {
      setVendorBatchStatuses(vendor, () => nextStatuses);
      setImportFeedback({
        tone: "error",
        message: "יש מק״טים כפולים. תקן לפני שמירה.",
      });
      return;
    }

    try {
      setBatchImportingVendor(vendor);
      setVendorBatchStatuses(vendor, () =>
        Object.fromEntries(
          filledRows.map((row) => [row.index, { tone: "info", message: "ממתין ליבוא..." }]),
        ),
      );
      setImportFeedback({
        tone: "info",
        message: `מייבא ${filledRows.length} מק״טים מ-${vendorLabel(vendor)} ושומר בסיום...`,
      });

      let workingPayload = structuredClone(payload);
      const previews: ImportPreview[] = [];
      let successCount = 0;

      const failedRows: string[] = [];
      const failedDetails: Array<{ catalog: string; reason: string }> = [];
      const succeededCatalogs: string[] = [];
      for (const row of filledRows) {
        // Each row is routed by its own content: a full URL is scraped directly
        // (eMAG / Amazon / bricstore / …), a catalog number goes through the
        // vendor source-chain (detected from the number). So a single batch can
        // mix catalogs and URLs — the section is just a starting point.
        const rowIsUrl = isUrlValue(row.catalogNumber);
        const rowLabel = rowIsUrl ? "כתובת" : vendorLabel(detectVendorFromCatalog(row.catalogNumber));
        setVendorBatchStatuses(vendor, (current) => ({
          ...current,
          [row.index]: { tone: "info", message: `מייבא מ-${rowLabel}...` },
        }));

        try {
          const data = rowIsUrl
            ? await importByUrlFromSource(row.catalogNumber)
            : await importCatalogNumberFromSource(
                detectVendorFromCatalog(row.catalogNumber),
                row.catalogNumber,
              );
          const result = upsertImportedItem(workingPayload, data);
          workingPayload = result.next;
          successCount += 1;
          succeededCatalogs.push(row.catalogNumber);
          previews.push({
            id: crypto.randomUUID(),
            title: data.item.title,
            coverImagePath: data.item.coverImagePath,
            catalogNumber: data.source.catalogNumber,
          });
          setVendorBatchStatuses(vendor, (current) => ({
            ...current,
            [row.index]: {
              tone: "success",
              message: `${result.mode === "updated" ? "עודכן מוצר קיים" : "נוצר מוצר חדש"} (${rowIsUrl ? data.source.catalogNumber : rowLabel})`,
            },
          }));
        } catch (error) {
          failedRows.push(row.catalogNumber);
          const reason = resolveErrorMessage(error, "שגיאת יבוא");
          failedDetails.push({ catalog: row.catalogNumber, reason });
          setVendorBatchStatuses(vendor, (current) => ({
            ...current,
            [row.index]: {
              tone: "error",
              message: `נכשל ב-${rowLabel}: ${reason}`,
            },
          }));
        }
      }

      // Persist the failed catalogs so the admin can review/copy them after the
      // import section is closed; drop any that succeeded this round.
      recordImportResults(succeededCatalogs, failedDetails);

      if (successCount === 0) {
        throw new Error("לא יובא אף מוצר. לא נשמרו שינויים.");
      }

      await persistPayload(workingPayload);
      setPayload(workingPayload);
      setImportPreviews((current) => [...previews, ...current].slice(0, 8));
      setStatus(`נשמרו ${successCount} מוצרים מייבוא מרובה.`);
      setImportFeedback({
        tone: failedRows.length > 0 ? "error" : "success",
        message:
          failedRows.length > 0
            ? `הייבוא הסתיים חלקית: ${successCount}/${filledRows.length} הצליחו ונשמרו. נכשלו: ${failedRows.join(", ")} — ראה פירוט ליד כל שורה.`
            : `הייבוא המרובה הסתיים ונשמר: ${successCount}/${filledRows.length} מוצרים הצליחו.`,
      });
    } catch (error) {
      const message = resolveErrorMessage(error, "שגיאת ייבוא מרובה");
      setStatus(message);
      setImportFeedback({ tone: "error", message });
    } finally {
      setBatchImportingVendor(null);
    }
  }

  const sortedItems = useMemo(
    () => [...payload.items].sort((a, b) => a.displayOrder - b.displayOrder),
    [payload.items],
  );

  return (
    <main className="admin-page">
      {!authReady && (
        <div className="admin-secret-backdrop" role="dialog" aria-modal="true">
          <form
            className="admin-secret-modal"
            dir="rtl"
            onSubmit={(e) => {
              e.preventDefault();
              window.localStorage.setItem(STORAGE_KEY, token);
              loadData(token);
            }}
          >
            <input
              type="password"
              value={token}
              autoFocus
              onChange={(e) => setToken(e.target.value)}
              placeholder="סיסמת אדמין"
            />
            <button type="submit">כניסה</button>
            {status && status !== "מחובר" && (
              <div className="admin-secret-status">{status}</div>
            )}
          </form>
        </div>
      )}

      {authReady && (
        <header className="admin-header">
          <h1>TOPTIK Admin</h1>
          <div className="admin-header-actions">
            {failedImports.length > 0 && (
              <button
                type="button"
                className="admin-failed-btn"
                onClick={() => setShowFailedModal(true)}
              >
                ⚠ העלאת מוצר אחד או יותר נכשלו ({failedImports.length})
              </button>
            )}
            <Link href="/" className="admin-back-link">
              חזרה לבית
            </Link>
          </div>
        </header>
      )}

      {showFailedModal && (
        <div
          className="admin-failed-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="מק״טים שנכשלו בייבוא"
          onClick={() => setShowFailedModal(false)}
        >
          <div className="admin-failed-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-failed-modal-head">
              <h2>מק״טים שלא עלו ({failedImports.length})</h2>
              <button
                type="button"
                className="admin-failed-copy-all"
                onClick={() =>
                  copyToClipboard(failedImports.map((f) => f.catalog).join("\n"), "__all__")
                }
              >
                {copiedKey === "__all__" ? "✓ הועתק" : "העתק הכל"}
              </button>
            </div>
            <ul className="admin-failed-list">
              {failedImports.map((f) => (
                <li key={f.catalog} className="admin-failed-row">
                  <button
                    type="button"
                    className="admin-failed-copy"
                    onClick={() => copyToClipboard(f.catalog, f.catalog)}
                    aria-label={`העתק ${f.catalog}`}
                  >
                    {copiedKey === f.catalog ? "✓" : "העתק"}
                  </button>
                  <span className="admin-failed-catalog" dir="ltr">{f.catalog}</span>
                  <span className="admin-failed-reason">{f.reason}</span>
                </li>
              ))}
            </ul>
            <div className="admin-failed-modal-foot">
              <button
                type="button"
                className="admin-failed-clear"
                onClick={() => {
                  setFailedImports([]);
                  setShowFailedModal(false);
                }}
              >
                נקה רשימה
              </button>
              <button type="button" onClick={() => setShowFailedModal(false)}>
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {authReady && (
        <>
          <section className="admin-batch-import">
            <div className="admin-items-head">
              <h2>ייבוא לפי כתובת מוצר (URL)</h2>
              <button onClick={onImportByUrl} disabled={isUrlImporting || isSaving || isBatchImporting}>
                {isUrlImporting ? "מייבא ושומר..." : "ייבא ושמור"}
              </button>
            </div>
            <p className="admin-import-note">
              הדבק כתובת של עמוד מוצר והמערכת תייבא אותו עם כל הפרטים (תמונות מכל הזוויות,
              צבעים, מפרט טכני ותיאור מתורגם). אתרים נתמכים:{" "}
              <span dir="ltr">mandarinaduck.com · bricstore.com · huntleather.com · amazon.de · emag.hu</span>
            </p>
            <div className="admin-url-import-row">
              <input
                value={urlImportValue}
                onChange={(e) => {
                  setUrlImportValue(e.target.value);
                  setUrlImportStatus(null);
                }}
                placeholder="https://bricstore.com/products/..."
                dir="ltr"
                disabled={isUrlImporting}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isUrlImporting) onImportByUrl();
                }}
              />
            </div>
            {urlImportStatus && (
              <div
                className={`admin-import-feedback admin-import-feedback-${urlImportStatus.tone}`}
                role="status"
              >
                {urlImportStatus.message}
              </div>
            )}
          </section>

          {VENDOR_OPTIONS.map((vendorOption) => {
            const vendor = vendorOption.value;
            const vendorInputs = batchCatalogInputs[vendor];
            const vendorStatuses = batchImportStatuses[vendor];
            const isThisVendorImporting = batchImportingVendor === vendor;
            return (
              <section key={`batch-${vendor}`} className="admin-batch-import">
                <div className="admin-items-head">
                  <h2>ייבוא מרובה — {vendorOption.label}</h2>
                  <button
                    onClick={() => onBatchImportAndSave(vendor)}
                    disabled={isBatchImporting || isSaving}
                  >
                    {isThisVendorImporting ? "מייבא ושומר..." : "ייבא ושמור הכל"}
                  </button>
                </div>
                <p className="admin-import-note">
                  הכנס מק״טים (למשל <span dir="ltr">{vendorOption.example}</span>) או טען
                  קובץ אקסל, ולחץ &quot;ייבא ושמור הכל&quot;. המערכת מזהה אוטומטית לכל מק״ט
                  אם הוא Mandarina Duck או Bric&apos;s — אפשר לערבב, ולא משנה מאיזה סקשן
                  מייבאים. כל צורת כתיבה מתקבלת (עם/בלי נקודות ומקפים). <b>אפשר גם להדביק
                  בשורה כתובת URL מלאה של מוצר</b> (<span dir="ltr">emag.hu · amazon.de ·
                  bricstore.com · huntleather.com · mandarinaduck.com</span>) והיא תיסרק
                  ישירות — כך שבייבוא אחד אפשר לערבב מק״טים וכתובות. ליד כל שורה יוצג חיווי
                  הצלחה/כישלון מפורט.
                </p>
                <div className="admin-batch-grid">
                  {vendorInputs.map((value, index) => {
                    const rowStatus = vendorStatuses[index];
                    return (
                      <label key={`batch-catalog-${vendor}-${index}`} className="admin-batch-row">
                        <span>{index + 1}</span>
                        <input
                          value={value}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setBatchCatalogInputs((current) => ({
                              ...current,
                              [vendor]: current[vendor].map((row, rowIndex) =>
                                rowIndex === index ? nextValue : row,
                              ),
                            }));
                            setVendorBatchStatuses(vendor, (current) => {
                              const next = { ...current };
                              delete next[index];
                              return next;
                            });
                          }}
                          placeholder="מק״ט"
                          dir="ltr"
                        />
                        <em className={rowStatus ? `admin-batch-status admin-batch-status-${rowStatus.tone}` : "admin-batch-status"}>
                          {rowStatus?.message || ""}
                        </em>
                      </label>
                    );
                  })}
                </div>
                <div className="admin-batch-actions">
                  <label className={`admin-batch-upload${isBatchImporting ? " is-disabled" : ""}`}>
                    📄 טעינה מקובץ אקסל
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void onExcelUpload(vendor, file);
                        e.target.value = "";
                      }}
                      disabled={isBatchImporting}
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-batch-add"
                    onClick={() =>
                      setBatchCatalogInputs((current) => ({
                        ...current,
                        [vendor]: [
                          ...current[vendor],
                          ...Array.from({ length: BATCH_IMPORT_INCREMENT }, () => ""),
                        ],
                      }))
                    }
                    disabled={isBatchImporting}
                  >
                    + הוסף {BATCH_IMPORT_INCREMENT} שדות
                  </button>
                  {vendorInputs.length > BATCH_IMPORT_INITIAL && (
                    <button
                      type="button"
                      className="admin-batch-remove"
                      onClick={() => {
                        setBatchCatalogInputs((current) => {
                          const trimmed = current[vendor].slice(0, -BATCH_IMPORT_INCREMENT);
                          const nextRows =
                            trimmed.length < BATCH_IMPORT_INITIAL
                              ? Array.from(
                                  { length: BATCH_IMPORT_INITIAL },
                                  (_, i) => current[vendor][i] ?? "",
                                )
                              : trimmed;
                          return { ...current, [vendor]: nextRows };
                        });
                        setVendorBatchStatuses(vendor, (current) => {
                          const next: typeof current = {};
                          const newLen = Math.max(
                            BATCH_IMPORT_INITIAL,
                            vendorInputs.length - BATCH_IMPORT_INCREMENT,
                          );
                          for (const key of Object.keys(current)) {
                            const idx = Number(key);
                            if (idx < newLen) next[idx] = current[idx];
                          }
                          return next;
                        });
                      }}
                      disabled={isBatchImporting}
                    >
                      − הסר {BATCH_IMPORT_INCREMENT} שדות
                    </button>
                  )}
                  <span className="admin-batch-count">סך שדות: {vendorInputs.length}</span>
                </div>
              </section>
            );
          })}

          <section className="admin-settings">
            <h2>הגדרות דפדוף</h2>
            <label>
              מהירות autoplay (ms)
              <input
                type="number"
                min={1500}
                max={12000}
                value={payload.settings.autoplayMs}
                onChange={(e) =>
                  setPayload((current) => ({
                    ...current,
                    settings: { ...current.settings, autoplayMs: Number(e.target.value) },
                  }))
                }
              />
            </label>
            <label>
              סוג מעבר דף בית → קטלוג
              <select
                value={payload.settings.transitionMode}
                onChange={(e) =>
                  setPayload((current) => ({
                    ...current,
                    settings: {
                      ...current.settings,
                      transitionMode: e.target.value as TransitionMode,
                    },
                  }))
                }
              >
                <option value="shatter-particle">Shatter / Particle</option>
                <option value="curtain-fade">Curtain Fade</option>
              </select>
            </label>
          </section>

          {importFeedback && (
            <div className={`admin-import-feedback admin-import-feedback-${importFeedback.tone}`}>
              {importFeedback.message}
            </div>
          )}

          {importPreviews.length > 0 && (
            <div className="admin-import-preview-list" aria-label="מוצרים שיובאו בהצלחה">
              {importPreviews.map((preview) => (
                <div key={preview.id} className="admin-import-preview-item">
                  <Image
                    src={preview.coverImagePath}
                    alt={preview.title}
                    width={52}
                    height={52}
                    className="admin-import-preview-image"
                    unoptimized
                  />
                  <div className="admin-import-preview-meta">
                    <div className="admin-import-preview-catalog">{preview.catalogNumber}</div>
                    <div className="admin-import-preview-title">{preview.title}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <section className="admin-items">
            <div className="admin-items-head">
              <h2>מוצרים</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="admin-save-inline-btn"
                  onClick={onSave}
                  disabled={isSaving || isBatchImporting}
                >
                  {isSaving ? "שומר..." : "שמור הכל"}
                </button>
                <button onClick={addItem}>הוסף מוצר</button>
                <button onClick={onExportExcel} disabled={payload.items.length === 0}>
                  הורד אקסל
                </button>
              </div>
            </div>

            {sortedItems.map((item) => {
              const itemIndex = payload.items.findIndex((row) => row.id === item.id);
              return (
                <article key={item.id} className="admin-item-card">
                  <div className="admin-item-head">
                    {item.coverImagePath ? (
                      <Image
                        src={item.coverImagePath}
                        alt={item.title}
                        width={64}
                        height={64}
                        className="admin-item-thumb"
                        unoptimized
                      />
                    ) : (
                      <div className="admin-item-thumb admin-item-thumb-empty" aria-hidden>
                        ?
                      </div>
                    )}
                    <h3>{item.title}</h3>
                    <button className="admin-danger-btn" onClick={() => removeItem(item.id)}>
                      מחק מוצר
                    </button>
                  </div>
                  <div className="admin-item-grid">
                    <label>
                      כותרת
                      <input
                        value={item.title}
                        onChange={(e) => updateItemField(itemIndex, "title", e.target.value)}
                      />
                    </label>
                    <label>
                      תיאור
                      <input
                        value={item.description ?? ""}
                        onChange={(e) => updateItemField(itemIndex, "description", e.target.value)}
                      />
                    </label>
                    <label>
                      מספר קטלוגי
                      <input
                        value={item.catalogNumber ?? ""}
                        onChange={(e) => updateItemField(itemIndex, "catalogNumber", e.target.value)}
                        placeholder="למשל: QMT32A74"
                      />
                    </label>
                    <label>
                      סדר תצוגה
                      <input
                        type="number"
                        value={item.displayOrder}
                        onChange={(e) => updateItemField(itemIndex, "displayOrder", Number(e.target.value))}
                      />
                    </label>
                    <label className={`checkbox-line admin-active-toggle ${item.isActive ? "is-active" : "is-inactive"}`}>
                      <span className="admin-active-label">
                        {item.isActive ? "פעיל" : "לא פעיל"}
                      </span>
                      <input
                        type="checkbox"
                        checked={item.isActive}
                        onChange={(e) => updateItemField(itemIndex, "isActive", e.target.checked)}
                      />
                    </label>
                    <label>
                      Cover URL
                      <input
                        value={item.coverImagePath}
                        onChange={(e) =>
                          setPayload((current) => {
                            const next = structuredClone(current);
                            next.items[itemIndex].coverImagePath = e.target.value;
                            return next;
                          })
                        }
                      />
                    </label>
                    <label>
                      כתובת מקור
                      <input
                        value={item.sourceUrl ?? ""}
                        onChange={(e) =>
                          setPayload((current) => {
                            const next = structuredClone(current);
                            const normalized = e.target.value.trim();
                            next.items[itemIndex].sourceUrl = normalized ? normalized : null;
                            return next;
                          })
                        }
                        placeholder="https://mandarinaduck.com/products/..."
                      />
                    </label>
                    <label>
                      העלאת Cover
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onCoverUpload(itemIndex, file);
                        }}
                      />
                    </label>
                    <label>
                      ונדור (מקור המוצר)
                      <select
                        value={vendorForItem(item)}
                        onChange={(e) =>
                          setItemVendorMap((current) => ({
                            ...current,
                            [item.id]: e.target.value as Vendor,
                          }))
                        }
                      >
                        {VENDOR_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="admin-item-import">
                      <label>
                        מספר קטלוגי ליבוא למוצר זה
                        <input
                          value={itemCatalogInputs[item.id] || ""}
                          onChange={(e) =>
                            setItemCatalogInputs((current) => ({
                              ...current,
                              [item.id]: e.target.value,
                            }))
                          }
                          placeholder={
                            VENDOR_OPTIONS.find((o) => o.value === vendorForItem(item))?.example
                          }
                          dir="ltr"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => onImportIntoItem(item.id)}
                        disabled={Boolean(itemImportingMap[item.id] || isSaving || isBatchImporting)}
                      >
                        {itemImportingMap[item.id] ? "מייבא..." : "ייבא למוצר זה"}
                      </button>
                    </div>
                  </div>

                  <p className="admin-import-note">
                    זוויות מוצר ({item.angles.length}) מתעדכנות אוטומטית בייבוא לפי מספר קטלוגי.
                  </p>
                </article>
              );
            })}
          </section>

          <section className="admin-save">
            <button onClick={onSave} disabled={isSaving || isBatchImporting}>
              {isSaving ? "שומר..." : "שמור הכל"}
            </button>
          </section>
        </>
      )}
    </main>
  );
}
