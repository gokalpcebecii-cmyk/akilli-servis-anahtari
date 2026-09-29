"use client";

// OTOİZ Aşama E.1: marka → model seçimi.
//
// Önce marka listeden seçilir, sonra o markanın modelleri gelir. Listede
// yoksa "Diğer / Elle gir" ile serbest yazılır. Değerler eskisi gibi düz
// metin olarak üst forma verilir; veritabanı değişmez. Listede olmayan eski
// kayıtlar elle giriş modunda, yazıldığı gibi açılır.
import { useEffect, useState } from "react";
import { colors, inputStyle, labelStyle } from "@/lib/theme";
const { BRANDS, findBrand, modelsFor, pickerState } = require("@/lib/vehicleCatalog");

const OTHER = "__diger__";

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
  WebkitAppearance: "none",
  paddingRight: 36,
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%235b6875' stroke-width='2' fill='none' stroke-linecap='round'/></svg>\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 14px center",
  minHeight: 48,
  cursor: "pointer",
};

const switchStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: "6px 0",
  minHeight: 32,
  color: colors.greenDark,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

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
  const initial = pickerState(brand, model);
  const [brandManual, setBrandManual] = useState(initial.brandMode === "manual");
  const [modelManual, setModelManual] = useState(initial.modelMode === "manual");

  // Kayıt sonradan yüklenirse (düzenleme formu) listede olmayan değer için
  // elle giriş moduna geç; kullanıcı değeri kaybolmaz.
  useEffect(() => {
    const st = pickerState(brand, model);
    if (st.brandMode === "manual" && !brandManual) setBrandManual(true);
    if (st.modelMode === "manual" && !modelManual && !brandManual) setModelManual(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, model]);

  const listBrand = brandManual ? null : findBrand(brand);
  const models: string[] = listBrand ? modelsFor(listBrand) : [];
  const listModel = listBrand && !modelManual ? models.find((m) => m.toLocaleLowerCase("tr-TR") === String(model || "").trim().toLocaleLowerCase("tr-TR")) ?? "" : "";

  const bId = `${idPrefix}-brand`;
  const mId = `${idPrefix}-model`;
  const err = (msg?: string, id?: string) =>
    msg ? (
      <p id={id} role="alert" style={{ color: colors.danger, fontSize: 12.5, margin: "4px 0 6px" }}>
        {msg}
      </p>
    ) : null;
  const border = (bad?: string) => ({ borderColor: bad ? colors.danger : colors.border });

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
              const b = findBrand(brand);
              onChange({ brand: b ?? "", model: b ? model : "" });
            }}
          >
            Listeden seç
          </button>
        </>
      ) : (
        <select
          id={bId}
          data-field="brand"
          aria-invalid={!!errors.brand}
          aria-describedby={errors.brand ? `${bId}-err` : undefined}
          style={{ ...selectStyle, ...border(errors.brand), color: listBrand ? colors.textDark : colors.textMuted }}
          value={listBrand ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === OTHER) {
              setBrandManual(true);
              setModelManual(true);
              onChange({ brand: "", model: "" });
              return;
            }
            setModelManual(false);
            onChange({ brand: v, model: v === listBrand ? model : "" });
          }}
        >
          <option value="">Marka seçin</option>
          {BRANDS.map((b: string) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
          <option value={OTHER}>Diğer / Elle gir</option>
        </select>
      )}
      {err(errors.brand, `${bId}-err`)}
    </div>
  );

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
                const found = models.find((m) => m.toLocaleLowerCase("tr-TR") === String(model || "").trim().toLocaleLowerCase("tr-TR"));
                onChange({ brand, model: found ?? "" });
              }}
            >
              Listeden seç
            </button>
          )}
        </>
      ) : (
        <select
          id={mId}
          data-field="model"
          disabled={!listBrand}
          aria-invalid={!!errors.model}
          aria-describedby={errors.model ? `${mId}-err` : undefined}
          style={{ ...selectStyle, ...border(errors.model), color: listModel ? colors.textDark : colors.textMuted, opacity: listBrand ? 1 : 0.6 }}
          value={listModel}
          onChange={(e) => {
            const v = e.target.value;
            if (v === OTHER) {
              setModelManual(true);
              onChange({ brand, model: "" });
              return;
            }
            onChange({ brand, model: v });
          }}
        >
          <option value="">{listBrand ? "Model seçin" : "Önce marka seçin"}</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          {listBrand && <option value={OTHER}>Diğer / Elle gir</option>}
        </select>
      )}
      {err(errors.model, `${mId}-err`)}
    </div>
  );

  return (
    <div
      data-testid="marka-model"
      className={layout === "row" ? "otoiz-brand-model" : undefined}
      style={{ display: "flex", flexDirection: layout === "row" ? "row" : "column", gap: layout === "row" ? 8 : 10, marginBottom: 10 }}
    >
      {brandField}
      {modelField}
    </div>
  );
}
