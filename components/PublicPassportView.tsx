import { colors, font, radius, badgeStyle, cardStyle } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";
import { Icon } from "@/components/Icon";

// Saf sunum bileşeni — herhangi bir veri çekme/Supabase çağrısı içermez.
// Gerçek public passport sayfası (app/p/[code]/page.tsx) get_public_vehicle_passport
// RPC'sinden dönen veriyi bu bileşene prop olarak geçirir; Playwright testleri
// de aynı bileşeni mock/fixture veriyle render eder — ekranın kendisi
// (görsel katman) her iki durumda da BİREBİR AYNI koddur.

const ITEM_DISPLAY: Record<string, { label: string; icon: string }> = {
  motor_yagi: { label: "Motor Yağı", icon: "wrench" },
  yag_filtresi: { label: "Yağ Filtresi", icon: "wrench" },
  hava_filtresi: { label: "Hava Filtresi", icon: "wrench" },
  polen_filtresi: { label: "Polen Filtresi", icon: "wrench" },
  fren_on_balata: { label: "Ön Fren Balatası", icon: "wrench" },
  fren_arka_balata: { label: "Arka Fren Balatası", icon: "wrench" },
  fren_disk_balata: { label: "Fren Disk-Balata", icon: "wrench" },
  triger_seti: { label: "Triger Seti", icon: "wrench" },
  aku: { label: "Akü", icon: "wrench" },
  lastik: { label: "Lastik", icon: "wrench" },
  fren_diski: { label: "Fren Diski", icon: "wrench" },
  buji: { label: "Buji", icon: "wrench" },
  silecek: { label: "Silecek", icon: "wrench" },
};

const ITEM_ORDER = [
  "motor_yagi",
  "yag_filtresi",
  "hava_filtresi",
  "polen_filtresi",
  "fren_on_balata",
  "fren_arka_balata",
  "triger_seti",
  "aku",
  "lastik",
  "fren_diski",
  "buji",
  "silecek",
];
// fren_disk_balata: eski/tek parça fren kaydı, geriye dönük uyumluluk için.
// Yeni araçlarda hiç kullanılmadığı için yalnızca o araçta gerçekten kaydı
// varsa listeye eklenir (aksi halde her araçta "Bilgi Yok" satırı olarak
// büyümesin).
const LEGACY_ITEM_KEY = "fren_disk_balata";

export interface PublicPassportData {
  vehicle: {
    plate: string;
    brand: string;
    model: string;
    year?: number | null;
    current_km?: number | null;
  };
  tenant?: { name?: string; phone?: string; address?: string } | null;
  maintenance_records?: any[];
  maintenance_items?: any[];
}

export function PublicPassportView({ passport }: { passport: PublicPassportData }) {
  const vehicle = passport.vehicle;
  const tenant = passport.tenant;
  const records: any[] = passport.maintenance_records ?? [];
  const maintenanceItems: any[] = passport.maintenance_items ?? [];

  function getItemStatus(itemKey: string): { label: string; kind: "success" | "warning" | "danger" | "neutral" } {
    const item = maintenanceItems.find((m: any) => m.item_key === itemKey);
    if (!item || !item.last_service_date) {
      return { label: "Bilgi Yok", kind: "neutral" };
    }

    let overdue = false;
    let upcoming = false;
    let hasInterval = false;

    if (item.interval_km && item.last_service_km != null) {
      hasInterval = true;
      const kmSince = (vehicle.current_km || 0) - item.last_service_km;
      const kmRemaining = item.interval_km - kmSince;
      if (kmRemaining <= 0) overdue = true;
      else if (kmRemaining <= 1000) upcoming = true;
    }

    if (item.interval_months) {
      hasInterval = true;
      const dueDate = new Date(item.last_service_date);
      dueDate.setMonth(dueDate.getMonth() + item.interval_months);
      const daysRemaining = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 0) overdue = true;
      else if (daysRemaining <= 30) upcoming = true;
    }

    if (!hasInterval) return { label: "Yapıldı", kind: "success" };
    if (overdue) return { label: "İşlem Zamanı", kind: "danger" };
    if (upcoming) return { label: "Yaklaşıyor", kind: "warning" };
    return { label: "Normal", kind: "success" };
  }

  const isVerified = (r: any) => Boolean(r.service_verified ?? r.tenant_id);
  const hasVerifiedRecord = records.some(isVerified);
  const lastServiceDate = records.reduce((latest: string | null, r: any) => {
    const d = r.service_date || r.created_at;
    return !latest || (d && d > latest) ? d : latest;
  }, null as string | null);

  const nextService = (() => {
    for (const key of ITEM_ORDER) {
      const item = maintenanceItems.find((m: any) => m.item_key === key);
      if (!item || !item.interval_km || item.last_service_km == null) continue;
      const kmRemaining = item.interval_km - ((vehicle.current_km || 0) - item.last_service_km);
      if (kmRemaining > 0) return `${kmRemaining.toLocaleString("tr-TR")} km sonra`;
    }
    return null;
  })();

  return (
    <main style={{ fontFamily: font, background: colors.surfaceSoft, minHeight: "100vh" }}>
      <div
        className="otoiz-hero-pattern"
        style={{ position: "relative", overflow: "hidden", background: `linear-gradient(160deg, ${colors.bg}, ${colors.surfaceDark})`, color: colors.textLight, padding: "24px 20px 42px", textAlign: "center" }}
      >
        <div className="otoiz-reflection" aria-hidden="true" />
        <div style={{ position: "relative", maxWidth: 460, margin: "0 auto" }}>
          <OtoizLogo variant="dark" size={170} mark="primary" />
          <div className="otoiz-accent-line" style={{ margin: "10px auto 0" }} />
          <p style={{ fontSize: 11.5, opacity: 0.6, marginTop: 10, letterSpacing: 0.3 }}>Aracınızın Dijital Servis Pasaportu</p>
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 460, margin: "-24px auto 0", padding: "0 20px" }}>
        <div style={{ ...cardStyle, boxShadow: "0 14px 34px rgba(6,20,33,0.14)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 0.8, color: colors.textDark }}>{vehicle.plate}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: colors.textDark, marginTop: 2 }}>
                {vehicle.brand} {vehicle.model}{vehicle.year ? ` · ${vehicle.year}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
              {hasVerifiedRecord ? (
                <span style={{ display: "flex", alignItems: "center", gap: 4, ...badgeStyle("success"), whiteSpace: "nowrap" }}>
                  <Icon name="shield-check" color={colors.greenDark} size={11} strokeWidth={2.5} />
                  Servis Doğrulamalı
                </span>
              ) : (
                <span style={{ display: "flex", alignItems: "center", gap: 4, ...badgeStyle("neutral"), whiteSpace: "nowrap" }}>
                  <Icon name="user" color={colors.textMuted} size={11} strokeWidth={2.5} />
                  Kullanıcı Kaydı
                </span>
              )}
              <span style={badgeStyle("success")}>Aktif</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: nextService ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10 }}>
            <div style={{ background: colors.surfaceSoft, borderRadius: radius.sm, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2 }}>GÜNCEL KM</div>
              <div style={{ fontSize: 19, fontWeight: 900, color: colors.textDark }}>{vehicle.current_km?.toLocaleString("tr-TR") ?? "—"}</div>
            </div>
            <div style={{ background: colors.surfaceSoft, borderRadius: radius.sm, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2 }}>SON SERVİS</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: colors.textDark }}>
                {lastServiceDate ? new Date(lastServiceDate).toLocaleDateString("tr-TR") : "—"}
              </div>
            </div>
            {nextService && (
              <div style={{ background: colors.greenSoft, borderRadius: radius.sm, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: colors.greenDark, marginBottom: 2 }}>SONRAKİ BAKIM</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: colors.greenDark }}>{nextService}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 460, margin: "0 auto", padding: "20px" }}>
        <h2 style={{ fontSize: 15, color: colors.textDark, marginBottom: 12, fontWeight: 800 }}>Araç Sağlık Özeti</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
          {[...ITEM_ORDER, ...(maintenanceItems.some((m: any) => m.item_key === LEGACY_ITEM_KEY) ? [LEGACY_ITEM_KEY] : [])].map((key) => {
            const display = ITEM_DISPLAY[key];
            const status = getItemStatus(key);
            return (
              <div key={key} style={{ ...cardStyle, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13.5, color: colors.textDark, display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name={display.icon} color={colors.textMuted} size={15} />
                  {display.label}
                </span>
                <span style={badgeStyle(status.kind)}>{status.label}</span>
              </div>
            );
          })}
        </div>

        <h2 style={{ fontSize: 15, color: colors.textDark, marginBottom: 12, fontWeight: 800 }}>Bakım Geçmişi</h2>
        {records.length === 0 ? (
          <p style={{ color: colors.textMuted, fontSize: 13 }}>Henüz kayıt bulunmuyor.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
            {records.map((r: any) => (
              <div key={r.id} style={{ ...cardStyle, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textDark }}>{r.description}</div>
                    <div style={{ fontSize: 11.5, color: colors.textMuted }}>
                      {new Date(r.created_at).toLocaleDateString("tr-TR")}
                      {r.km_at_service != null ? ` · ${r.km_at_service.toLocaleString("tr-TR")} km` : ""}
                    </div>
                  </div>
                  {isVerified(r) ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, ...badgeStyle("success"), whiteSpace: "nowrap" }}>
                      <Icon name="shield-check" color={colors.greenDark} size={11} strokeWidth={2.5} />
                      Servis Doğrulamalı
                    </span>
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, ...badgeStyle("neutral"), whiteSpace: "nowrap" }}>
                      <Icon name="user" color={colors.textMuted} size={11} strokeWidth={2.5} />
                      Kullanıcı Kaydı
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bireysel (servissiz) araçlarda boş "Yetkili Servis" kartı gösterilmez. */}
        {tenant?.name && (
          <>
            <h2 style={{ fontSize: 15, color: colors.textDark, marginBottom: 12, fontWeight: 800 }}>Yetkili Servis</h2>
            <div style={cardStyle}>
              <p style={{ fontSize: 14, fontWeight: 700, color: colors.textDark, margin: "0 0 4px" }}>{tenant?.name}</p>
              <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 2px" }}>{tenant?.phone}</p>
              <p style={{ fontSize: 12.5, color: colors.textMuted, margin: 0 }}>{tenant?.address}</p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export function PublicPassportMessage({ title, body }: { title: string; body: string }) {
  return (
    <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, display: "flex", alignItems: "center" }}>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: 20, color: colors.textDark, fontWeight: 800 }}>{title}</h1>
        <p style={{ color: colors.textMuted }}>{body}</p>
      </div>
    </main>
  );
}
