"use client";
// OTOİZ — "Pilot Kontrol Merkezi": tek ekrandan pilot sağlığı.
import { useEffect, useState } from "react";
import { colors, font, radius, inputStyle, cardStyle } from "@/lib/theme";

type Api = (path: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; body: any }>;

const OZET_LABELS: Record<string, string> = {
  toplamPilot: "Toplam pilot",
  aktive: "Aktive",
  aracEkleyen: "Araç ekleyen",
  ilkKayitYapan: "İlk kayıt yapan",
  belgeEkleyen: "Belge ekleyen",
  aliciRaporuKullanan: "Alıcı Raporu kullanan",
  geriBildirimGonderen: "Geri bildirim gönderen",
  acikSorun: "Açık sorun",
  yediGunGeriDonen: "7 gün geri dönen",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric" });
}

export function PilotMerkeziTab({ api }: { api: Api }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const r = await api("/api/admin/pilot-merkezi");
    setLoading(false);
    if (r.ok) setData(r.body);
    else setError(r.body?.error || "Pilot özeti yüklenemedi");
  }

  useEffect(() => { load(); }, []);

  return (
    <section style={{ ...cardStyle, fontFamily: font }} aria-label="Pilot Kontrol Merkezi">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, margin: 0, marginRight: "auto" }}>Pilot Kontrol Merkezi</h2>
        <button onClick={load} disabled={loading} style={{ minHeight: 44, padding: "0 14px", borderRadius: radius.sm, border: `1px solid ${colors.border}`, background: colors.surfaceLight, cursor: "pointer", fontWeight: 700 }}>
          {loading ? "Yükleniyor…" : "Yenile"}
        </button>
      </div>
      {error && <p role="alert" style={{ color: colors.danger, fontWeight: 700 }}>{error}</p>}
      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
            {Object.entries(OZET_LABELS).map(([k, label]) => (
              <div key={k} style={{ background: colors.surfaceRaised, borderRadius: radius.md, padding: "12px 14px", border: `1px solid ${colors.border}` }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: k === "acikSorun" && data.ozet[k] > 0 ? colors.danger : colors.text }}>{data.ozet[k]}</div>
                <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: colors.textMuted }}>
                  <th style={{ padding: "8px 6px" }}>Kullanıcı</th>
                  <th style={{ padding: "8px 6px" }}>Seri</th>
                  <th style={{ padding: "8px 6px" }}>QR</th>
                  <th style={{ padding: "8px 6px" }}>Araç</th>
                  <th style={{ padding: "8px 6px" }}>Kayıt</th>
                  <th style={{ padding: "8px 6px" }}>Belge</th>
                  <th style={{ padding: "8px 6px" }}>Alıcı Raporu</th>
                  <th style={{ padding: "8px 6px" }}>Geri bildirim</th>
                  <th style={{ padding: "8px 6px" }}>7 gün</th>
                </tr>
              </thead>
              <tbody>
                {(data.rows ?? []).map((r: any) => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${colors.border}` }}>
                    <td style={{ padding: "8px 6px", color: colors.text, fontWeight: 700 }}>{r.email}</td>
                    <td style={{ padding: "8px 6px" }}>{r.serial_nos ?? "—"}</td>
                    <td style={{ padding: "8px 6px" }}>{r.has_activated ? (r.has_revoked ? "iptal" : "aktif") : "rezerve"}</td>
                    <td style={{ padding: "8px 6px" }}>{r.first_plate ? `${r.first_plate} (${r.vehicle_count})` : "—"}</td>
                    <td style={{ padding: "8px 6px" }}>{r.record_count > 0 ? `${r.record_count} · ${fmtDate(r.last_record_at)}` : "—"}</td>
                    <td style={{ padding: "8px 6px" }}>{r.document_count}</td>
                    <td style={{ padding: "8px 6px" }}>{r.buyer_share_count > 0 ? r.buyer_share_count : "—"}</td>
                    <td style={{ padding: "8px 6px" }}>{r.feedback_count}{r.feedback_open > 0 ? ` (${r.feedback_open} açık)` : ""}</td>
                    <td style={{ padding: "8px 6px" }}>{r.returned_7d === "evet" ? "evet" : r.returned_7d === "bekleniyor" ? "bekleniyor" : "hayır"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
