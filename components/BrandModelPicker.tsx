"use client";

// OTOİZ Aşama E.1: marka → model seçimi.
//
// Liste sunucudan (/api/arac-katalogu) yüklenir. Marka alanına dokununca
// aramalı bir seçim paneli açılır; marka seçilince model paneli kendiliğinden
// o markanın modelleriyle açılır. Listede yoksa "Diğer / Elle gir" ile serbest
// yazılır. Yükleniyor, hata (Tekrar dene) ve sonuç yok durumları vardır.
//
// Değerler eskisi gibi düz metin olarak üst forma verilir; veritabanı
// değişmez. Listede olmayan eski kayıtlar elle giriş modunda, yazıldığı gibi
// açılır.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { colors, font, inputStyle, labelStyle, errorTextStyle } from "@/lib/theme";
import { Icon } from "@/components/Icon";
const { findBrand, modelsFor, findModel, pickerState, searchNames } = require("@/lib/vehicleCatalogSearch");

type Brand = { name: string; models: string[] };
type Status = "loading" | "ready" | "error";

let cache: Brand[] | null = null;
let inflight: Promise<Brand[]> | null = null;

function loadCatalog(): Promise<Brand[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch("/api/arac-katalogu", { headers: { accept: "application/json" } })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        if (!Array.isArray(j?.brands) || j.brands.length === 0) throw new Error("boş liste");
        cache = j.brands as Brand[];
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

function useVehicleCatalog() {
  const [state, setState] = useState<{ status: Status; brands: Brand[] }>(() =>
    cache ? { status: "ready", brands: cache } : { status: "loading", brands: [] }
  );
  const load = useCallback(() => {
    setState((s) => (s.status === "ready" ? s : { status: "loading", brands: [] }));
    loadCatalog()
      .then((brands) => setState({ status: "ready", brands }))
      .catch(() => setState({ status: "error", brands: [] }));
  }, []);
  useEffect(() => {
    if (!cache) load();
  }, [load]);
  return { ...state, retry: load };
}

const triggerStyle: React.CSSProperties = {
  ...inputStyle,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  minHeight: 52,
  textAlign: "left",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};

const switchStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: "6px 0",
  minHeight: 40,
  color: colors.greenLight,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

const rowStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 52,
  padding: "12px 18px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  background: "none",
  border: "none",
  borderBottom: `1px solid ${colors.border}`,
  fontSize: 16,
  color: colors.text,
  textAlign: "left",
  cursor: "pointer",
  fontFamily: "inherit",
};

function Chevron() {
  return (
    <svg aria-hidden="true" width="12" height="8" viewBox="0 0 12 8" style={{ flexShrink: 0 }}>
      <path d="M1 1l5 5 5-5" stroke="#A9B3C1" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function PickerSheet({
  kind,
  title,
  searchPlaceholder,
  status,
  items,
  selected,
  emptyText,
  onPick,
  onManual,
  onRetry,
  onClose,
}: {
  kind: "brand" | "model";
  title: string;
  searchPlaceholder: string;
  status: Status;
  items: string[];
  selected: string;
  emptyText: string;
  onPick: (v: string) => void;
  onManual: (typed: string) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const shown: string[] = status === "ready" ? searchNames(items, q) : [];
  const typed = q.trim();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Dokunmatik ekranda klavye listeyi kapatmasın: aramaya yalnız fareli
    // cihazda otomatik odaklan; telefonda kullanıcı arama kutusuna dokunur.
    const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    if (!coarse) searchRef.current?.focus();
    else boxRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      data-testid={`secim-paneli-${kind}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(8,10,14,0.72)",
        fontFamily: font,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "max(12px, env(safe-area-inset-top)) 12px 12px",
      }}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          width: "min(520px, 100%)",
          maxHeight: "calc(100dvh - 24px)",
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 18,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
          outline: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 12px 10px 18px" }}>
          <strong style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>{title}</strong>
          <button type="button" onClick={onClose} style={{ ...switchStyle, fontSize: 15, minHeight: 44, padding: "0 8px" }}>
            Kapat
          </button>
        </div>
        <div style={{ padding: "0 14px 12px", position: "relative" }}>
          <span aria-hidden="true" style={{ position: "absolute", left: 30, top: 16, display: "flex", pointerEvents: "none" }}>
            <Icon name="search" color={colors.textFaint} size={20} />
          </span>
          <input
            ref={searchRef}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (shown.length > 0) onPick(shown[0]);
                else if (typed) onManual(typed);
              }
            }}
            style={{ ...inputStyle, minHeight: 52, paddingLeft: 46, background: colors.bg }}
          />
        </div>
        <div style={{ overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", borderTop: `1px solid ${colors.border}` }}>
          {status === "loading" && (
            <p role="status" className="otoiz-skeleton" style={{ padding: "18px 18px", margin: 12, borderRadius: 12, color: colors.textMuted, fontSize: 15 }}>
              Liste yükleniyor…
            </p>
          )}
          {status === "error" && (
            <div role="alert" style={{ padding: "18px 16px" }}>
              <p style={{ margin: "0 0 10px", color: colors.danger, fontSize: 15 }}>Liste yüklenemedi. İnternet bağlantınızı kontrol edin.</p>
              <div style={{ display: "flex", gap: 16 }}>
                <button type="button" onClick={onRetry} style={{ ...switchStyle, fontSize: 15 }}>
                  Tekrar dene
                </button>
                <button type="button" onClick={() => onManual(typed)} style={{ ...switchStyle, fontSize: 15 }}>
                  Elle gir
                </button>
              </div>
            </div>
          )}
          {status === "ready" && (
            <ul role="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {shown.length === 0 && (
                <li style={{ padding: "16px 16px 6px", color: colors.textMuted, fontSize: 14.5 }} role="status">
                  {typed ? `“${typed}” listede bulunamadı.` : emptyText}
                </li>
              )}
              {shown.map((name) => (
                <li key={name}>
                  <button type="button" aria-current={name === selected ? "true" : undefined} onClick={() => onPick(name)} style={{ ...rowStyle, fontWeight: name === selected ? 800 : 500, background: name === selected ? colors.greenSoft : "none", color: name === selected ? colors.greenLight : colors.text }}>
                    <span>{name}</span>
                    {name === selected && <Icon name="check" color={colors.greenLight} size={18} />}
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => onManual(typed)} style={{ ...rowStyle, color: colors.greenLight, fontWeight: 700, borderBottom: "none" }}>
                  {typed && shown.length === 0 ? `“${typed}” olarak elle gir` : "Diğer / Elle gir"}
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function BrandModelPicker({
  brand,
  model,
  onChange,
  errors = {},
  idPrefix = "arac",
  layout = "row",
}: {
  brand: string;
  model: string;
  onChange: (next: { brand: string; model: string }) => void;
  errors?: { brand?: string; model?: string };
  idPrefix?: string;
  layout?: "row" | "stack";
}) {
  const catalog = useVehicleCatalog();
  const ready = catalog.status === "ready";
  const [brandManual, setBrandManual] = useState(false);
  const [modelManual, setModelManual] = useState(false);
  const [open, setOpen] = useState<null | "brand" | "model">(null);
  const focusAfter = useRef<null | "brand" | "model" | "brand-manual" | "model-manual">(null);

  // Liste yüklenince (ya da kayıt sonradan gelince) listede olmayan değer
  // için elle giriş moduna geç; kullanıcı değeri kaybolmaz.
  useEffect(() => {
    if (!ready) return;
    const st = pickerState(catalog.brands, brand, model);
    if (st.brandMode === "manual" && !brandManual) setBrandManual(true);
    if (st.modelMode === "manual" && !modelManual && !brandManual) setModelManual(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, brand, model]);

  const bId = `${idPrefix}-brand`;
  const mId = `${idPrefix}-model`;

  useEffect(() => {
    const f = focusAfter.current;
    if (!f) return;
    focusAfter.current = null;
    const id = f.startsWith("brand") ? bId : mId;
    document.getElementById(id)?.focus();
  });

  const listBrand: string | null = ready && !brandManual ? findBrand(catalog.brands, brand) : null;
  const models: string[] = listBrand ? modelsFor(catalog.brands, listBrand) : [];
  const listModel: string = listBrand && !modelManual ? findModel(catalog.brands, listBrand, model) ?? "" : "";
  // Liste henüz yüklenmediyse kayıttaki değer olduğu gibi gösterilir.
  const brandShown = listBrand ?? (ready ? "" : brand || "");
  const modelShown = listModel || (ready ? "" : model || "");

  const err = (msg?: string, id?: string) =>
    msg ? (
      <p id={id} role="alert" style={errorTextStyle}>
        {msg}
      </p>
    ) : null;
  const border = (bad?: string) => ({ borderColor: bad ? colors.danger : colors.border });

  function closeTo(which: "brand" | "model") {
    setOpen(null);
    focusAfter.current = which;
  }

  const brandField = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label htmlFor={bId} style={labelStyle}>
        Marka
      </label>
      {brandManual ? (
        <>
          <input
            id={bId}
            data-field="brand"
            autoComplete="off"
            aria-invalid={!!errors.brand}
            aria-describedby={errors.brand ? `${bId}-err` : undefined}
            placeholder="Markayı yazın"
            style={{ ...inputStyle, ...border(errors.brand) }}
            value={brand || ""}
            onChange={(e) => onChange({ brand: e.target.value, model })}
          />
          <button
            type="button"
            style={switchStyle}
            onClick={() => {
              setBrandManual(false);
              setModelManual(false);
              const b = ready ? findBrand(catalog.brands, brand) : null;
              onChange({ brand: b ?? "", model: b ? model : "" });
              setOpen("brand");
            }}
          >
            Listeden seç
          </button>
        </>
      ) : (
        <button
          id={bId}
          type="button"
          data-field="brand"
          data-value={brandShown}
          aria-haspopup="dialog"
          aria-expanded={open === "brand"}
          aria-invalid={!!errors.brand}
          aria-describedby={errors.brand ? `${bId}-err` : undefined}
          onClick={() => setOpen("brand")}
          style={{ ...triggerStyle, ...border(errors.brand), color: brandShown ? colors.text : colors.textMuted }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{brandShown || "Marka seçin"}</span>
          <Chevron />
        </button>
      )}
      {err(errors.brand, `${bId}-err`)}
    </div>
  );

  const modelDisabled = !brandShown && !brandManual;
  const modelField = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label htmlFor={mId} style={labelStyle}>
        Model
      </label>
      {brandManual || modelManual ? (
        <>
          <input
            id={mId}
            data-field="model"
            autoComplete="off"
            aria-invalid={!!errors.model}
            aria-describedby={errors.model ? `${mId}-err` : undefined}
            placeholder="Modeli yazın"
            style={{ ...inputStyle, ...border(errors.model) }}
            value={model || ""}
            onChange={(e) => onChange({ brand, model: e.target.value })}
          />
          {!brandManual && (
            <button
              type="button"
              style={switchStyle}
              onClick={() => {
                setModelManual(false);
                const found = listBrand ? findModel(catalog.brands, listBrand, model) : null;
                onChange({ brand, model: found ?? "" });
                setOpen("model");
              }}
            >
              Listeden seç
            </button>
          )}
        </>
      ) : (
        <button
          id={mId}
          type="button"
          data-field="model"
          data-value={modelShown}
          aria-haspopup="dialog"
          aria-expanded={open === "model"}
          disabled={modelDisabled}
          aria-invalid={!!errors.model}
          aria-describedby={errors.model ? `${mId}-err` : undefined}
          onClick={() => setOpen("model")}
          style={{ ...triggerStyle, ...border(errors.model), color: modelShown ? colors.text : colors.textMuted, opacity: modelDisabled ? 0.6 : 1, cursor: modelDisabled ? "not-allowed" : "pointer" }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{modelShown || (modelDisabled ? "Önce marka seçin" : "Model seçin")}</span>
          <Chevron />
        </button>
      )}
      {err(errors.model, `${mId}-err`)}
    </div>
  );

  return (
    <div
      data-testid="marka-model"
      data-katalog={catalog.status}
      className={layout === "row" ? "otoiz-brand-model" : undefined}
      style={{ display: "flex", flexDirection: layout === "row" ? "row" : "column", gap: layout === "row" ? 10 : 16, marginBottom: 16 }}
    >
      {brandField}
      {modelField}
      {open === "brand" && (
        <PickerSheet
          kind="brand"
          title="Marka seçin"
          searchPlaceholder="Marka ara"
          status={catalog.status}
          items={catalog.brands.map((b) => b.name)}
          selected={listBrand ?? ""}
          emptyText="Liste boş."
          onRetry={catalog.retry}
          onClose={() => closeTo("brand")}
          onPick={(name) => {
            setModelManual(false);
            if (name === listBrand) {
              closeTo("brand");
              return;
            }
            onChange({ brand: name, model: "" });
            // Marka seçilince o markanın modelleri hemen gelsin.
            setOpen("model");
          }}
          onManual={(typed) => {
            setOpen(null);
            setBrandManual(true);
            setModelManual(true);
            onChange({ brand: typed, model: "" });
            focusAfter.current = "brand-manual";
          }}
        />
      )}
      {open === "model" && (
        <PickerSheet
          kind="model"
          title={listBrand ? `${listBrand} modeli seçin` : "Model seçin"}
          searchPlaceholder="Model ara"
          status={catalog.status}
          items={models}
          selected={listModel}
          emptyText="Bu marka için liste yok. Elle girebilirsiniz."
          onRetry={catalog.retry}
          onClose={() => closeTo("model")}
          onPick={(name) => {
            onChange({ brand: listBrand ?? brand, model: name });
            closeTo("model");
          }}
          onManual={(typed) => {
            setOpen(null);
            setModelManual(true);
            onChange({ brand: listBrand ?? brand, model: typed });
            focusAfter.current = "model-manual";
          }}
        />
      )}
    </div>
  );
}
