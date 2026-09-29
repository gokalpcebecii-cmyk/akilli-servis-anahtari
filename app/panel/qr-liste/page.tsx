"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import QRCode from "qrcode";
import { colors, font, radius, cardStyle } from "@/lib/theme";
const { printableQrUrl } = require("@/lib/qrUrl");
const { keysetOrFilter, PAGE_SIZE } = require("@/lib/pagination");

export default function QrListePage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [items, setItems] = useState<any[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unassigned" | "assigned">("all");
  // P1: 50'lik sayfa; QR resmi yalnız "QR göster" ile üretilir (yüzlerce
  // resmi aynı anda üretmek telefonu kilitliyordu).
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);


  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/panel/login");
        return;
      }

      await loadPage(null, filter);
      setLoading(false);
    }
    load();
  }, []);

  async function loadPage(after: any | null, f: typeof filter) {
    let q = supabase
      .from("qr_keys")
      .select("id, code, vehicle_id, created_at, vehicles(plate, brand, model)")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE + 1);
    let c = supabase.from("qr_keys").select("id", { count: "exact", head: true });
    if (f === "unassigned") { q = q.is("vehicle_id", null); c = c.is("vehicle_id", null); }
    if (f === "assigned") { q = q.not("vehicle_id", "is", null); c = c.not("vehicle_id", "is", null); }
    if (after) q = q.or(keysetOrFilter({ t: after.created_at, id: after.id }));
    const [{ data }, countRes] = await Promise.all([q, after ? Promise.resolve(null) : c]);
    const rows = data ?? [];
    setHasMore(rows.length > PAGE_SIZE);
    setItems((prev) => (after ? [...prev, ...rows.slice(0, PAGE_SIZE)] : rows.slice(0, PAGE_SIZE)));
    if (countRes) setTotal((countRes as any).count ?? null);
  }

  async function showQr(code: string) {
    const url = printableQrUrl(code);
    if (!url || images[code]) return;
    const img = await QRCode.toDataURL(url, { width: 300, margin: 1 });
    setImages((prev) => ({ ...prev, [code]: img }));
  }

  const filtered = items;

  function downloadOne(code: string) {
    const link = document.createElement("a");
    link.href = images[code];
    link.download = `qr-${code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading) return <main style={{ padding: 24, textAlign: "center", color: colors.textMuted, fontFamily: font }}>Yükleniyor…</main>;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px", fontFamily: font, color: colors.textDark }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Tüm QR Kodlarım</h1>
      <p style={{ color: colors.textMuted, fontSize: 14, marginBottom: 20 }}>{total ?? items.length} adet QR kodu{items.length < (total ?? 0) ? ` · ${items.length} gösteriliyor` : ""}.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["all", "unassigned", "assigned"] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); loadPage(null, f); }}
            style={{
              padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${colors.border}`, fontSize: 13, cursor: "pointer",
              background: filter === f ? colors.surfaceDark : colors.surfaceLight, color: filter === f ? colors.textLight : colors.textDark,
            }}
          >
            {f === "all" ? "Tümü" : f === "unassigned" ? "Boş" : "Eşleşmiş"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
        {filtered.map((item) => (
          <div key={item.code} style={{ ...cardStyle, padding: 10, textAlign: "center" }}>
            {images[item.code] ? (
              <img src={images[item.code]} alt={item.code} style={{ width: "100%", borderRadius: 6, marginBottom: 6 }} />
            ) : (
              <button onClick={() => showQr(item.code)} style={{ width: "100%", minHeight: 44, marginBottom: 6, fontSize: 12, background: colors.surfaceSoft, border: `1px dashed ${colors.border}`, borderRadius: 6, cursor: "pointer" }}>
                QR göster
              </button>
            )}
            <p style={{ fontSize: 10, color: colors.textMuted, wordBreak: "break-all", marginBottom: 4 }}>{item.code}</p>
            {item.vehicles ? (
              <p style={{ fontSize: 11, color: colors.greenDark, fontWeight: 600, marginBottom: 6 }}>{item.vehicles.plate}</p>
            ) : (
              <p style={{ fontSize: 11, color: colors.textMuted, marginBottom: 6 }}>Boş</p>
            )}
            <button onClick={() => downloadOne(item.code)} disabled={!images[item.code]} style={{ fontSize: 11, padding: "6px 12px", background: colors.surfaceSoft, border: "none", borderRadius: 6, cursor: "pointer", minHeight: 32 }}>
              İndir
            </button>
          </div>
        ))}
      </div>
      {hasMore && (
        <button onClick={() => loadPage(items[items.length - 1], filter)} style={{ marginTop: 16, width: "100%", minHeight: 44, border: `1px solid ${colors.border}`, borderRadius: radius.sm, background: colors.surfaceLight, cursor: "pointer", fontWeight: 700 }}>
          Daha fazla göster
        </button>
      )}
    </main>
  );
}
