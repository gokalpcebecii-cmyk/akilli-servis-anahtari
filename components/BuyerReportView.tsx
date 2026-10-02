"use client";

// OTOİZ — Alıcı Raporu buyer view (public). Premium, sade, satış sunumu.
// Normal dashboard görevleri yok; düzenleme/aktif QR kontrolleri YOK.
import { colors, font, radius, cardStyle } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";
import { Icon } from "@/components/Icon";

type Report = {
  vehicle: { plate: string; brand: string; model: string; year: number | null; current_km: number | null; next_service_km: number | null; next_service_date: string | null; muayene_tarihi: string | null; kasko_bitis: string | null; trafik_sigortasi_bitis: string | null };
  stats: { total: number; servis: number; bireysel: number };
  last: { date: string; km: number | null; items: string; source: string } | null;
  chronology: { date: string; km: number | null; items: string; source: string }[];
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

function MuayeneDates({ vehicle }: { vehicle: Report["vehicle"] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[
        { label: "Muayene", v: vehicle.muayene_tarihi },
        { label: "Kasko", v: vehicle.kasko_bitis },
        { label: "Zorunlu Trafik Sigortası", v: vehicle.trafik_sigortasi_bitis },
      ].map((f) => (
        <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${colors.border}` }}>
          <span style={{ color: colors.textMuted, fontSize: 13.5 }}>{f.label}</span>
          <span style={{ color: colors.text, fontWeight: 700, fontSize: 14 }}>{fmtDate(f.v)}</span>
        </div>
      ))}
    </div>
  );
}

export function BuyerReportView({ report }: { report: Report }) {
  const proof = `${report.stats.total} kayıt · ${report.stats.servis} servis doğrulamalı · ${report.stats.bireysel} bireysel kayıt`;
  return (
    <main style={{ minHeight: "100vh", background: colors.bg, fontFamily: font }}>
      <header style={{ background: `linear-gradient(180deg, ${colors.bgAlt} 0%, ${colors.bg} 100%)`, borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 16px 24px" }}>
          <div style={{ marginBottom: 18 }}>
            <OtoizLogo variant="dark" size={110} />
          </div>
          <p style={{ fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", color: colors.greenLight, fontWeight: 800, margin: "0 0 8px" }}>Otoiz Alıcı Raporu</p>
          <h1 style={{ fontSize: 27, fontWeight: 800, color: colors.text, margin: "0 0 6px" }}>{report.vehicle.plate}</h1>
          <p style={{ color: colors.textMuted, margin: "0 0 14px", fontSize: 15 }}>
            {[report.vehicle.brand, report.vehicle.model].filter(Boolean).join(" ") || "Marka/model belirtilmedi"}
            {report.vehicle.year ? ` · ${report.vehicle.year}` : ""}
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: colors.greenSoft, padding: "8px 14px", borderRadius: radius.pill }}>
            <Icon name="shield-check" color={colors.greenLight} size={16} />
            <span style={{ color: colors.greenLight, fontWeight: 700, fontSize: 13.5 }}>Dijital servis pasaportu aktif</span>
          </div>
        </div>
      </header>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <section style={{ ...cardStyle, padding: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: colors.text, margin: "0 0 10px" }}>Kanıt Özeti</h2>
          <p style={{ color: colors.text, margin: "0 0 14px", fontSize: 14.5, fontWeight: 700 }}>{proof}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              ["Toplam bakım kaydı", report.stats.total],
              ["Servis doğrulamalı", report.stats.servis],
              ["Araç sahibi kaydı", report.stats.bireysel],
              ["Son bakım tarihi", fmtDate(report.last?.date ?? null)],
              ["Son bakım km", report.last?.km ? `${report.last.km.toLocaleString("tr-TR")} km` : "—"],
              ["Güncel km", report.vehicle.current_km ? `${report.vehicle.current_km.toLocaleString("tr-TR")} km` : "—"],
              ["Sonraki bakım", report.vehicle.next_service_km ? `${report.vehicle.next_service_km.toLocaleString("tr-TR")} km` : "—"],
              ["Sonraki bakım tarihi", fmtDate(report.vehicle.next_service_date)],
            ].map(([k, v]) => (
              <div key={k as string} style={{ background: colors.surfaceRaised, borderRadius: radius.sm, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, color: colors.textMuted }}>{k}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: colors.text, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        </section>
        <section style={{ ...cardStyle, padding: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: colors.text, margin: "0 0 10px" }}>Önemli Tarihler</h2>
          <MuayeneDates vehicle={report.vehicle} />
        </section>
        <section style={{ ...cardStyle, padding: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: colors.text, margin: "0 0 12px" }}>Bakım Geçmişi</h2>
          {report.chronology.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: 14 }}>Henüz bakım kaydı bulunmuyor.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {report.chronology.map((r, i) => (
                <div key={i} style={{ background: colors.surfaceRaised, borderRadius: radius.sm, padding: "12px 14px" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: colors.text }}>
                    {fmtDate(r.date)}{r.km ? ` · ${r.km.toLocaleString("tr-TR")} km` : ""}
                  </div>
                  <div style={{ fontSize: 14, color: colors.textMuted, marginTop: 4, lineHeight: 1.5 }}>{r.items || "Bakım kaydı"}</div>
                  <div style={{ marginTop: 8, display: "inline-block", fontSize: 11.5, fontWeight: 800, letterSpacing: 0.4, padding: "3px 10px", borderRadius: radius.pill, background: r.source === "servis" ? colors.greenSoft : colors.neutralSoft, color: r.source === "servis" ? colors.greenLight : colors.textMuted }}>
                    {r.source === "servis" ? "SERVİS DOĞRULAMALI ✓" : "ARAÇ SAHİBİ KAYDI"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <p style={{ color: colors.textFaint, fontSize: 12.5, lineHeight: 1.5, margin: "4px 0 24px" }}>
          OTOİZ Alıcı Raporu, sisteme kaydedilmiş bakım ve araç bilgilerini gösterir. Ekspertiz veya mekanik durum garantisi değildir.
        </p>
      </div>
    </main>
  );
}
