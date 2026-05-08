"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CarouselPayload, TransitionMode } from "@/lib/carousel/types";
import { fallbackCarouselPayload } from "@/lib/carousel/fallback-data";

const STORAGE_KEY = "toptik_admin_token";
const BATCH_IMPORT_SIZE = 25;
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
  const [catalogNumber, setCatalogNumber] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [batchCatalogInputs, setBatchCatalogInputs] = useState<string[]>(
    Array.from({ length: BATCH_IMPORT_SIZE }, () => ""),
  );
  const [batchImportStatuses, setBatchImportStatuses] = useState<Record<number, BatchImportStatus>>({});
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [itemCatalogInputs, setItemCatalogInputs] = useState<Record<string, string>>({});
  const [itemImportingMap, setItemImportingMap] = useState<Record<string, boolean>>({});
  const [importFeedback, setImportFeedback] = useState<{
    tone: ImportFeedbackTone;
    message: string;
  } | null>(null);
  const [importPreviews, setImportPreviews] = useState<ImportPreview[]>([]);

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
    const existingIndex = targetItemId
      ? next.items.findIndex((item) => item.id === targetItemId)
      : next.items.findIndex((item) => {
          if (!normalizedCatalog) return false;
          const byCatalogNumber =
            normalizeCatalogNumber(item.catalogNumber ?? "") === normalizedCatalog;
          return byCatalogNumber;
        });

    if (existingIndex >= 0) {
      const existing = next.items[existingIndex];
      next.items[existingIndex] = {
        ...existing,
        title: data.item.title,
        description: data.item.description,
        catalogNumber: data.item.catalogNumber ?? data.source.catalogNumber,
        sourceUrl: data.item.sourceUrl ?? null,
        coverImagePath: data.item.coverImagePath,
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

  async function importCatalogNumberFromSource(
    activeCatalogNumber: string,
    targetItemId?: string,
  ): Promise<ImportedItemData> {
    const res = await fetch("/api/admin/import/mandarina", {
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
        isActive: false,
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

  async function onSave() {
    try {
      setIsSaving(true);
      setStatus("שומר...");
      const cleanedPayload = {
        ...payload,
        items: payload.items.filter(
          (item) => item.catalogNumber?.trim() || !item.coverImagePath.includes("hero-web-airport"),
        ),
      };
      if (cleanedPayload.items.length < payload.items.length) {
        setPayload(cleanedPayload);
      }
      await persistPayload(cleanedPayload);
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

  async function onImportByCatalog() {
    if (!catalogNumber.trim()) {
      setStatus("יש להזין מספר קטלוגי");
      setImportFeedback({
        tone: "error",
        message: "יש להזין מספר קטלוגי ליבוא.",
      });
      return;
    }

    try {
      setIsImporting(true);
      setStatus("מייבא מוצר לפי מספר קטלוגי...");
      setImportFeedback({
        tone: "info",
        message: "מתבצע ייבוא, נא להמתין...",
      });
      const data = await importCatalogNumberFromSource(catalogNumber);

      setPayload((current) => {
        return upsertImportedItem(current, data).next;
      });

      setStatus(
        `ייבוא הושלם: ${data.source.catalogNumber} עם ${data.source.importedImages} תמונות. לחץ "שמור הכל" לקיבוע.`,
      );
      setImportFeedback({
        tone: "success",
        message: `הייבוא הצליח: ${data.source.catalogNumber} (${data.source.importedImages} תמונות). עכשיו לחץ שמור הכל.`,
      });
      setImportPreviews((current) => [
        {
          id: crypto.randomUUID(),
          title: data.item.title,
          coverImagePath: data.item.coverImagePath,
          catalogNumber: data.source.catalogNumber,
        },
        ...current,
      ].slice(0, 8));
      setCatalogNumber("");
    } catch (error) {
      const message = resolveErrorMessage(error, "שגיאת ייבוא לפי מספר קטלוגי");
      setStatus(message);
      setImportFeedback({
        tone: "error",
        message,
      });
    } finally {
      setIsImporting(false);
    }
  }

  async function onImportIntoExistingItem(itemId: string) {
    const itemCatalogNumber = (itemCatalogInputs[itemId] || "").trim();
    if (!itemCatalogNumber) {
      setStatus("יש להזין מספר קטלוגי ליבוא למוצר");
      setImportFeedback({
        tone: "error",
        message: "יש להזין מספר קטלוגי ליבוא למוצר זה.",
      });
      return;
    }

    try {
      setItemImportingMap((current) => ({ ...current, [itemId]: true }));
      setStatus(`מייבא למוצר קיים: ${itemCatalogNumber}...`);
      setImportFeedback({
        tone: "info",
        message: `מתבצע ייבוא למוצר קיים (${itemCatalogNumber})...`,
      });

      const data = await importCatalogNumberFromSource(itemCatalogNumber, itemId);

      setPayload((current) => {
        return upsertImportedItem(current, data, itemId).next;
      });

      setItemCatalogInputs((current) => ({ ...current, [itemId]: "" }));
      setStatus(
        `ייבוא למוצר קיים הושלם: ${data.source.catalogNumber} עם ${data.source.importedImages} תמונות. לחץ "שמור הכל".`,
      );
      setImportFeedback({
        tone: "success",
        message: `עודכן מוצר קיים (${data.source.catalogNumber}) עם ${data.source.importedImages} תמונות. לחץ שמור הכל.`,
      });
      setImportPreviews((current) => [
        {
          id: crypto.randomUUID(),
          title: data.item.title,
          coverImagePath: data.item.coverImagePath,
          catalogNumber: data.source.catalogNumber,
        },
        ...current,
      ].slice(0, 8));
    } catch (error) {
      const message = resolveErrorMessage(error, "שגיאת ייבוא למוצר קיים");
      setStatus(message);
      setImportFeedback({
        tone: "error",
        message,
      });
    } finally {
      setItemImportingMap((current) => ({ ...current, [itemId]: false }));
    }
  }

  async function onBatchImportAndSave() {
    const normalizedRows = batchCatalogInputs.map((value, index) => ({
      index,
      catalogNumber: normalizeCatalogNumber(value),
    }));
    const filledRows = normalizedRows.filter((row) => row.catalogNumber);
    const nextStatuses: Record<number, BatchImportStatus> = {};

    if (filledRows.length === 0) {
      setBatchImportStatuses({
        0: { tone: "error", message: "יש להזין לפחות מק״ט אחד." },
      });
      return;
    }

    const seen = new Map<string, number>();
    for (const row of filledRows) {
      const firstIndex = seen.get(row.catalogNumber);
      if (firstIndex !== undefined) {
        nextStatuses[row.index] = { tone: "error", message: `מק״ט כפול בשורה ${firstIndex + 1}` };
        nextStatuses[firstIndex] = { tone: "error", message: `מק״ט כפול בשורה ${row.index + 1}` };
      } else {
        seen.set(row.catalogNumber, row.index);
      }
    }

    if (Object.keys(nextStatuses).length > 0) {
      setBatchImportStatuses(nextStatuses);
      setImportFeedback({
        tone: "error",
        message: "יש מק״טים כפולים. תקן לפני שמירה.",
      });
      return;
    }

    try {
      setIsBatchImporting(true);
      setBatchImportStatuses(
        Object.fromEntries(
          filledRows.map((row) => [row.index, { tone: "info", message: "ממתין ליבוא..." }]),
        ),
      );
      setImportFeedback({
        tone: "info",
        message: `מייבא ${filledRows.length} מק״טים ושומר בסיום...`,
      });

      let workingPayload = structuredClone(payload);
      const previews: ImportPreview[] = [];
      let successCount = 0;

      for (const row of filledRows) {
        setBatchImportStatuses((current) => ({
          ...current,
          [row.index]: { tone: "info", message: "מייבא..." },
        }));

        try {
          const data = await importCatalogNumberFromSource(row.catalogNumber);
          const result = upsertImportedItem(workingPayload, data);
          workingPayload = result.next;
          successCount += 1;
          previews.push({
            id: crypto.randomUUID(),
            title: data.item.title,
            coverImagePath: data.item.coverImagePath,
            catalogNumber: data.source.catalogNumber,
          });
          setBatchImportStatuses((current) => ({
            ...current,
            [row.index]: {
              tone: "success",
              message: result.mode === "updated" ? "עודכן מוצר קיים" : "נוצר מוצר חדש",
            },
          }));
        } catch (error) {
          const message = resolveErrorMessage(error, "לא נמצא מק״ט או שגיאת יבוא");
          setBatchImportStatuses((current) => ({
            ...current,
            [row.index]: { tone: "error", message },
          }));
        }
      }

      if (successCount === 0) {
        throw new Error("לא יובא אף מוצר. לא נשמרו שינויים.");
      }

      await persistPayload(workingPayload);
      setPayload(workingPayload);
      setImportPreviews((current) => [...previews, ...current].slice(0, 8));
      setStatus(`נשמרו ${successCount} מוצרים מייבוא מרובה.`);
      setImportFeedback({
        tone: "success",
        message: `הייבוא המרובה הסתיים ונשמר: ${successCount}/${filledRows.length} מוצרים הצליחו.`,
      });
    } catch (error) {
      const message = resolveErrorMessage(error, "שגיאת ייבוא מרובה");
      setStatus(message);
      setImportFeedback({ tone: "error", message });
    } finally {
      setIsBatchImporting(false);
    }
  }

  const sortedItems = useMemo(
    () => [...payload.items].sort((a, b) => a.displayOrder - b.displayOrder),
    [payload.items],
  );

  return (
    <main className="admin-page">
      <header className="admin-header">
        <h1>TOPTIK Admin</h1>
        <Link href="/" className="admin-back-link">
          חזרה לבית
        </Link>
      </header>

      <section className="admin-auth">
        <label>
          Admin Token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="הזן ADMIN_PANEL_TOKEN"
          />
        </label>
        <button
          onClick={() => {
            window.localStorage.setItem(STORAGE_KEY, token);
            loadData(token);
          }}
        >
          התחבר
        </button>
        <div className="admin-status">{status}</div>
      </section>

      {authReady && (
        <>
          <section className="admin-batch-import">
            <div className="admin-items-head">
              <h2>ייבוא מרובה לפי מק״טים</h2>
              <button onClick={onBatchImportAndSave} disabled={isBatchImporting || isSaving || isImporting}>
                {isBatchImporting ? "מייבא ושומר..." : "ייבא ושמור הכל"}
              </button>
            </div>
            <p className="admin-import-note">
              הכנס עד 25 מק״טים. המערכת תשלוף ממנדרינה, תיצור/תעדכן מוצרים, ותשמור הכל בפעולה אחת.
            </p>
            <div className="admin-batch-grid">
              {batchCatalogInputs.map((value, index) => {
                const rowStatus = batchImportStatuses[index];
                return (
                  <label key={`batch-catalog-${index}`} className="admin-batch-row">
                    <span>{index + 1}</span>
                    <input
                      value={value}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setBatchCatalogInputs((current) =>
                          current.map((row, rowIndex) => (rowIndex === index ? nextValue : row)),
                        );
                        setBatchImportStatuses((current) => {
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
          </section>

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

          <section className="admin-import">
            <h2>ייבוא אוטומטי מ-Mandarina Duck</h2>
            <div className="admin-import-prompt">הכנס מספר קטלוגי ליבוא</div>
            <div className="admin-import-row">
              <label className="admin-import-field">
                <span>מספר קטלוגי</span>
                <input
                  value={catalogNumber}
                  onChange={(e) => setCatalogNumber(e.target.value)}
                  placeholder="הכנס מספר קטלוגי ליבוא"
                />
              </label>
              <div className="admin-import-actions">
                <button onClick={onImportByCatalog} disabled={isImporting || isSaving || isBatchImporting}>
                  {isImporting ? "מייבא..." : "ייבא לפי מספר קטלוגי"}
                </button>
                <button className="admin-save-inline-btn" onClick={onSave} disabled={isSaving || isImporting || isBatchImporting}>
                  {isSaving ? "שומר..." : "שמור הכל"}
                </button>
              </div>
            </div>
            <p className="admin-import-note">
              דוגמה: <span dir="ltr">QMT32A74</span>. אחרי הייבוא לחץ &#34;שמור הכל&#34; כדי לקבע.
            </p>
            {importFeedback && (
              <div className={`admin-import-feedback admin-import-feedback-${importFeedback.tone}`}>
                {importFeedback.message}
              </div>
            )}
            {importPreviews.length > 0 && (
              <div className="admin-import-preview-list" aria-label="מוצרים שיובאו בהצלחה">
                {importPreviews.map((preview) => (
                  <div key={preview.id} className="admin-import-preview-item">
                    {/* preview thumb helps identify imported product quickly */}
                    <Image
                      src={preview.coverImagePath}
                      alt={preview.title}
                      width={52}
                      height={52}
                      className="admin-import-preview-image"
                    />
                    <div className="admin-import-preview-meta">
                      <div className="admin-import-preview-catalog">{preview.catalogNumber}</div>
                      <div className="admin-import-preview-title">{preview.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="admin-items">
            <div className="admin-items-head">
              <h2>מוצרים</h2>
              <button onClick={addItem}>הוסף מוצר</button>
            </div>

            {sortedItems.map((item) => {
              const itemIndex = payload.items.findIndex((row) => row.id === item.id);
              return (
                <article key={item.id} className="admin-item-card">
                  <div className="admin-item-head">
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
                    <label className="checkbox-line">
                      פעיל
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
                    <div className="admin-item-import">
                      <label>
                        הכנס מספר קטלוגי ליבוא למוצר זה
                        <input
                          value={itemCatalogInputs[item.id] || ""}
                          onChange={(e) =>
                            setItemCatalogInputs((current) => ({
                              ...current,
                              [item.id]: e.target.value,
                            }))
                          }
                          placeholder="מספר קטלוגי למוצר זה"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => onImportIntoExistingItem(item.id)}
                        disabled={Boolean(itemImportingMap[item.id] || isImporting || isSaving || isBatchImporting)}
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
