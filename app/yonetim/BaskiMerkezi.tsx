"use client";

// OTOİZ Aşama B — Baskı Merkezi yardımcıları: tarayıcıda dosya üretimi,
// otomatik doğrulama ve sonuç paneli. Ağır kütüphaneler (pdf-lib, fontkit,
// jsQR, fflate) yalnız gerektiğinde yüklenir.

import { colors, font, radius } from "@/lib/theme";
const { qrBaseUrl, printableQrUrl } = require("@/lib/qrUrl");

export type Item = { id?: string; serial_no: string; token: string; activation_code?: string };
export type FileKey = "qr_pdf" | "packing_pdf" | "print_csv" | "packing_csv" | "serial_txt" | "svg_zip" | "secret_csv";

export const FILE_LABELS: Record<FileKey, string> = {
  qr_pdf: "1. QR Baskı PDF",
  packing_pdf: "2. Paketleme Kartları PDF",
  print_csv: "3. Baskı CSV",
  packing_csv: "4. Paketleme CSV",
  serial_txt: "5. Seri Listesi",
  svg_zip: "6. QR SVG ZIP",
  secret_csv: "7. Yönetici Gizli Arşivi",
};

let pcPromise: Promise<any> | null = null;
function loadPc() {
  if (!pcPromise) pcPromise = import("@/lib/printCenter").then((m: any) => m.default ?? m);
  return pcPromise;
}

let fontsPromise: Promise<any> | null = null;
function loadFonts() {
  if (!fontsPromise) {
    const get = (f: string) => fetch(`/fonts/pdf/${f}`).then((r) => {
      if (!r.ok) throw new Error(`font ${f}`);
      return r.arrayBuffer();
    });
    fontsPromise = Promise.all([get("DejaVuSans.ttf"), get("DejaVuSans-Bold.ttf"), get("DejaVuSansMono-Bold.ttf")])
      .then(([regular, bold, mono]) => ({ regular, bold, mono }))
      .catch((e) => {
        fontsPromise = null;
        throw e;
      });
  }
  return fontsPromise;
}

async function ctxFor(label: string, items: Item[]) {
  const pc = await loadPc();
  const fonts = await loadFonts();
  const base = qrBaseUrl();
  return {
    pc,
    ctx: {
      label, items, fonts, qrUrlFor: printableQrUrl,
      staging: !pc.isProductionBase(base),
      appOrigin: typeof window !== "undefined" ? window.location.origin : "",
    },
    base,
  };
}

const nextFrame = () => new Promise((r) => setTimeout(r, 0));

// Tarayıcı kontrolleri: adres biçimi, yasak içerik, QR geri okuma,
// benzersizlik, ortam ve (verilen) tüm dosyaların üretilebilmesi.
export async function runClientChecks(label: string, items: Item[], expected: number, scope: "generation" | "reverify") {
  const { pc, ctx, base } = await ctxFor(label, items);
  await nextFrame();
  const r = pc.checkItems(items, printableQrUrl, base, expected);
  await nextFrame();
  const keys = scope === "generation" ? [...pc.PRINT_FILES, ...pc.SECRET_FILES] : pc.PRINT_FILES;
  const files = await pc.checkFiles(keys, ctx);
  return {
    ok: r.ok && files.ok,
    scope,
    base,
    printable: items.length,
    checks: r.checks,
    files: files.files,
    problems: r.problems,
  };
}

function save(name: string, mime: string, data: Uint8Array) {
  const blob = new Blob([data as BlobPart], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function downloadFile(key: FileKey, label: string, items: Item[]) {
  const { pc, ctx } = await ctxFor(label, items);
  const f = await pc.buildFile(key, ctx);
  save(f.name, f.mime, f.data);
}

export async function downloadZip(kind: "print" | "all", label: string, items: Item[]) {
  const { pc, ctx } = await ctxFor(label, items);
  const keys = kind === "all" ? [...pc.PRINT_FILES, ...pc.SECRET_FILES] : pc.PRINT_FILES;
  const z = await pc.buildZip(keys, ctx);
  const pre = `${ctx.staging ? "STAGING_" : ""}${pc.fileSafe(label)}`;
  save(`${pre}_${kind === "all" ? "TUM_DOSYALAR_GIZLI" : "baski_paketi"}.zip`, "application/zip", z);
}

// ---------------------------------------------------------------------------
// Sonuç paneli
// ---------------------------------------------------------------------------
function Row({ label, value, ok, muted }: { label: string; value: string; ok: boolean | null; muted?: boolean }) {
  const color = ok === null ? colors.textMuted : ok ? colors.greenDark : colors.danger;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: `1px solid ${colors.border}`, fontSize: 13.5 }}>
      <span style={{ color: muted ? colors.textMuted : colors.textDark }}>{label}</span>
      <strong style={{ color, textAlign: "right" }}>{value}</strong>
    </div>
  );
}

function frac(c: any, fallbackTotal: number) {
  if (!c) return { text: "—", ok: null as boolean | null };
  const total = c.total ?? fallbackTotal;
  if (c.ok === null || c.ok === undefined) return { text: "Ölçülmedi", ok: null };
  return { text: `${c.passed ?? (c.ok ? total : 0)}/${total} ${c.ok ? "PASS" : "FAIL"}`, ok: !!c.ok };
}

export function VerificationPanel({ v, label, busy }: { v: any; label?: string; busy?: boolean }) {
  if (busy) {
    return (
      <div role="status" style={{ padding: 14, borderRadius: radius.md, background: colors.neutralSoft, fontWeight: 700, fontSize: 14 }}>
        Otomatik doğrulama çalışıyor… (QR'lar tek tek okunuyor, dosyalar üretiliyor)
      </div>
    );
  }
  if (!v) {
    return (
      <div style={{ padding: 12, borderRadius: radius.md, background: colors.neutralSoft, fontSize: 13.5, color: colors.textMuted }}>
        Bu parti henüz doğrulanmadı. "Doğrula" ile kontrolü başlatın.
      </div>
    );
  }
  const s = v.checks ?? {};
  const c = v.client?.checks ?? {};
  const n = v.count ?? 0;
  const dup = (s.token_unique?.duplicates ?? 0) + (c.duplicates?.count ?? 0);
  const missing = s.no_missing?.missing ?? 0;
  const wrongDomain = (c.forbidden_content?.count ?? 0) + (c.url_format ? (c.url_format.total ?? 0) - (c.url_format.passed ?? 0) : 0);
  const filesOk = v.client?.files && Object.values(v.client.files).length > 0 && Object.values(v.client.files).every((f: any) => f.ok);
  const staging = c.environment && c.environment.ok === false;
  const qr = c.qr_decode ? frac(c.qr_decode, n) : { text: "Ölçülmedi", ok: null };
  const code = frac(s.code_match, n);
  const ready = !!v.ready;
  return (
    <div data-testid="batch-verification" style={{ border: `2px solid ${ready ? colors.greenDark : colors.danger}`, borderRadius: radius.md, padding: 14, background: colors.surfaceLight }}>
      {label && <Row label="Batch" value={label} ok={null} muted />}
      <Row label="Seri aralığı" value={v.serial_first ? `${v.serial_first} – ${v.serial_last}` : "—"} ok={null} muted />
      <Row label="Ürün adedi" value={`${n}${s.count_match && !s.count_match.ok ? ` (beklenen ${s.count_match.expected})` : ""}`} ok={s.count_match ? !!s.count_match.ok : null} />
      <Row label="QR doğrulama" value={qr.text} ok={qr.ok} />
      <Row label="Aktivasyon eşleşmesi" value={code.ok === null ? "Üretimde ölçülmedi" : code.text} ok={code.ok} />
      <Row label="Duplicate" value={String(dup)} ok={dup === 0} />
      <Row label="Eksik" value={String(missing)} ok={missing === 0} />
      <Row label="Yanlış domain" value={staging ? "TEST ORTAMI" : String(wrongDomain)} ok={!staging && wrongDomain === 0} />
      <Row label="Baskı dosyaları" value={filesOk ? "HAZIR" : "HAZIR DEĞİL"} ok={!!filesOk} />
      {s.serial_contiguous && !s.serial_contiguous.ok && (
        <p style={{ fontSize: 12.5, color: colors.warning, margin: "8px 0 0" }}>Uyarı: seri numaraları kesintili (aynı anda başka parti üretilmiş olabilir).</p>
      )}
      <div
        data-testid="batch-ready"
        style={{
          marginTop: 12, padding: "12px 14px", borderRadius: radius.sm, textAlign: "center", fontWeight: 700, fontSize: 17, letterSpacing: 0.5,
          background: ready ? colors.greenSoft : colors.dangerSoft, color: ready ? colors.greenDark : colors.danger, fontFamily: font,
        }}
      >
        SONUÇ: {ready ? "BASKIYA HAZIR" : "BASKIYA HAZIR DEĞİL"}
      </div>
      {!ready && Array.isArray(v.client?.problems) && v.client.problems.length > 0 && (
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12.5, color: colors.danger }}>
          {v.client.problems.slice(0, 6).map((p: string, i: number) => <li key={i}>{p}</li>)}
        </ul>
      )}
      {!ready && code.ok === null && (
        <p style={{ fontSize: 12.5, color: colors.textMuted, margin: "8px 0 0" }}>
          Aktivasyon kodları yalnız üretim anında görülebildiği için bu parti için kod eşleşmesi burada ölçülemiyor.
        </p>
      )}
    </div>
  );
}
