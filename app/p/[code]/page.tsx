import { createAnonServerSupabase } from "@/lib/supabase";
import { colors, font, radius, badgeStyle, cardStyle } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
];
// fren_disk_balata: eski/tek parça fren kaydı, geriye dönük uyumluluk için.
// Yeni araçlarda hiç kullanılmadığı için yalnızca o araçta gerçekten kaydı
// varsa listeye eklenir (aksi halde her araçta "Bilgi Yok" satırı olarak
// büyümesin).
const LEGACY_ITEM_KEY = "fren_disk_balata";

export default async function PassportByCodePage({ params }: { params: { code: string } }) {
  // Bu sayfa herkese açık olduğundan service role yerine anon key kullanır;
  // get_public_vehicle_passport() SECURITY DEFINER fonksiyonu anon rolüne
  // EXECUTE ile açıktır ve döndürdüğü alanları kendi içinde sınırlar. Tüm
  // qr_keys/vehicles/tenants tablolarını doğrudan okumak yerine, yalnızca
  // verilen kod geçerliyse (ve iptal edilmemişse) minimum pasaport verisini
  // döndüren bu güvenli DB fonksiyonu çağrılıyor.
  const supabase = createAnonServerSupabase();
  const { data: passport } = await supabase.rpc("get_public_vehicle_passport", {
    p_code: params.code,
  });

  if (!passport) {
    return (
      <PublicMessage title="Geçersiz Kod" body="Bu QR kod sistemde tanımlı değil." />
    );
  }

  if (passport.status === "unassigned") {
    return (
      <PublicMessage title="Henüz Eşleştirilmemiş" body="Bu anahtarlık henüz bir araca bağlanmamış." />
    );
  }

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

  const hasVerifiedRecord = records.some((r: any) => r.tenant_id);
  const lastServiceDate = records.reduce((latest: string | null, r: any) => {
    const d = r.service_date || r.created_at;
    return !latest || (d && d > latest) ? d : latest;
  }, null as string | null);

  return (
    <main style={{ fontFamily: font, background: colors.surfaceSoft, minHeight: "100vh" }}>
      <div style={{ background: `linear-gradient(160deg, ${colors.bg}, ${colors.surfaceDark})`, color: colors.textLight, padding: "22px 20px 40px", textAlign: "center" }}>
        <div style={{ maxWidth: 460, margin: "0 auto" }}>
          <OtoizLogo variant="dark" size={15} mark="primary" />
          <p style={{ fontSize: 11.5, opacity: 0.6, marginTop: 6, letterSpacing: 0.3 }}>Aracınızın Dijital Servis Pasaportu</p>
        </div>
      </div>

      <div style={{ maxWidth: 460, margin: "-24px auto 0", padding: "0 20px" }}>
        <div style={{ ...cardStyle, boxShadow: "0 14px 34px rgba(6,20,33,0.14)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 21, fontWeight: 800, color: colors.textDark }}>{vehicle.plate}</div>
              <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                {vehicle.brand} {vehicle.model}{vehicle.year ? ` · ${vehicle.year}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
              {hasVerifiedRecord && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, ...badgeStyle("success"), whiteSpace: "nowrap" }}>
                  <Icon name="shield-check" color={colors.greenDark} size={11} strokeWidth={2.5} />
                  Servis Doğrulamalı
                </span>
              )}
              <span style={badgeStyle("success")}>Aktif</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: colors.surfaceSoft, borderRadius: radius.sm, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2 }}>GÜNCEL KM</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: colors.textDark }}>{vehicle.current_km?.toLocaleString("tr-TR") ?? "—"}</div>
            </div>
            <div style={{ background: colors.surfaceSoft, borderRadius: radius.sm, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2 }}>SON SERVİS</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: colors.textDark }}>
                {lastServiceDate ? new Date(lastServiceDate).toLocaleDateString("tr-TR") : "—"}
              </div>
            </div>
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
                  <ProvenanceBadge verified={!!r.tenant_id} />
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 style={{ fontSize: 15, color: colors.textDark, marginBottom: 12, fontWeight: 800 }}>Yetkili Servis</h2>
        <div style={cardStyle}>
          <p style={{ fontSize: 14, fontWeight: 700, color: colors.textDark, margin: "0 0 4px" }}>{tenant?.name}</p>
          <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 2px" }}>{tenant?.phone}</p>
          <p style={{ fontSize: 12.5, color: colors.textMuted, margin: 0 }}>{tenant?.address}</p>
        </div>
      </div>
    </main>
  );
}

function ProvenanceBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 4, ...badgeStyle("success"), whiteSpace: "nowrap" }}>
        <Icon name="shield-check" color={colors.greenDark} size={11} strokeWidth={2.5} />
        Servis Doğrulamalı
      </span>
    );
  }
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4, ...badgeStyle("neutral"), whiteSpace: "nowrap" }}>
      <Icon name="user" color={colors.textMuted} size={11} strokeWidth={2.5} />
      Kullanıcı Kaydı
    </span>
  );
}

function PublicMessage({ title, body }: { title: string; body: string }) {
  return (
    <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, display: "flex", alignItems: "center" }}>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: 20, color: colors.textDark, fontWeight: 800 }}>{title}</h1>
        <p style={{ color: colors.textMuted }}>{body}</p>
      </div>
    </main>
  );
}
