"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, radius } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { OtoizLogo } from "@/components/OtoizLogo";
import { BottomNav } from "@/components/BottomNav";
import { PILOT_FLAGS } from "@/lib/pilotFlags";

const { plateSearchKey, describeMaintenancePlan } = require("@/lib/logic");

const MODULES = [
  { key: "servis-gecmisi", title: "Servis Geçmişi", desc: "Yapılan tüm bakım ve onarım kayıtları.", icon: "history" },
  { key: "kilometre", title: "Kilometre Kayıtları", desc: "Güncel km ve geçmiş okumalar.", icon: "gauge" },
  { key: "parca", title: "Parça Değişimleri", desc: "Yağ, filtre, balata, lastik ve daha fazlası.", icon: "wrench" },
  { key: "muayene", title: "Muayene Bilgileri", desc: "Muayene ve sigorta notlarınız.", icon: "clipboard" },
  { key: "qr", title: "QR / NFC Yönetimi", desc: "Aktif kodu görün, iptal edin veya yenileyin.", icon: "qr" },
  { key: "devir", title: "Sahiplik Devri", desc: "Aracı güvenle yeni sahibine devredin.", icon: "swap" },
].filter((m) =>
  // Pilot: güvenlik kabulü bekleyen özellikler menüde hiç görünmez
  // (bkz. lib/pilotFlags.ts). Bayrak açılınca kart kendiliğinden geri gelir.
  (m.key !== "qr" || PILOT_FLAGS.qrSelfIssuance) &&
  (m.key !== "devir" || PILOT_FLAGS.ownershipTransferSelfService)
);

export default function BireyselAraclarPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  async function loadPendingTransfers() {
    // Pilotta bu RPC'nin EXECUTE yetkisi authenticated'dan alındı; çağırmak
    // yalnızca konsolda hata üretir.
    if (!PILOT_FLAGS.ownershipTransferSelfService) {
      setPendingTransfers([]);
      return;
    }
    const { data } = await supabase.rpc("list_my_pending_outgoing_transfers");
    setPendingTransfers(data ?? []);
  }

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/bireysel/giris");
        return;
      }
      setEmail(session.session.user.email ?? null);

      const { data: vehicleList } = await supabase
        .from("vehicles")
        .select("*")
        .eq("owner_user_id", session.session.user.id)
        .order("created_at", { ascending: false });

      setVehicles(vehicleList ?? []);
      await loadPendingTransfers();
      setLoading(false);
    }
    load();
  }, []);

  async function handleCancelTransfer(token: string) {
    setCancelling(token);
    const { error } = await supabase.rpc("cancel_ownership_transfer", { p_token: token });
    setCancelling(null);
    if (error) {
      alert("İptal edilemedi. Sayfayı yenileyip tekrar deneyin.");
      return;
    }
    await loadPendingTransfers();
    const { data: session } = await supabase.auth.getSession();
    if (session.session) {
      const { data: vehicleList } = await supabase
        .from("vehicles")
        .select("*")
        .eq("owner_user_id", session.session.user.id)
        .order("created_at", { ascending: false });
      setVehicles(vehicleList ?? []);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/bireysel/giris");
  }

  const filtered = search ? vehicles.filter((v) => plateSearchKey(v.plate).includes(plateSearchKey(search))) : vehicles;
  const primary = filtered[0];
  const rest = filtered.slice(1);
  const firstName = email ? email.split("@")[0] : "";

  if (loading) {
    return <main style={{ padding: 24, textAlign: "center", color: colors.textMuted, fontFamily: font }}>Yükleniyor…</main>;
  }

  return (
    <main className="otoiz-has-bottom-nav otoiz-dashboard-shell" style={{ minHeight: "100vh", fontFamily: font }}>
      <div
        className="otoiz-hero-pattern"
        style={{
          position: "relative", overflow: "hidden",
          background: `linear-gradient(160deg, ${colors.bg} 0%, ${colors.bgAlt} 55%, ${colors.surfaceDark} 100%)`,
          padding: "22px 14px 36px", boxShadow: "0 18px 30px -14px rgba(6,20,33,0.45)",
        }}
      >
        <div className="otoiz-reflection" aria-hidden="true" />
        <div className="otoiz-dashboard-container" style={{ maxWidth: 480, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <OtoizLogo variant="dark" size={255} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => router.push("/bireysel/bildirimler")}
                aria-label="Bildirimler"
                style={{
                  position: "relative", width: 34, height: 34, borderRadius: "50%",
                  background: "rgba(255,255,255,0.08)", border: "none", display: "flex",
                  alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <Icon name="bell" color={colors.textLight} size={16} />
                {pendingTransfers.length > 0 && (
                  <span style={{ position: "absolute", top: 5, right: 6, width: 7, height: 7, borderRadius: "50%", background: colors.green }} />
                )}
              </button>
              <button
                onClick={() => router.push("/bireysel/profil")}
                aria-label="Profil"
                style={{
                  width: 34, height: 34, borderRadius: "50%", background: colors.green, border: "none",
                  color: colors.textDark, fontWeight: 800, fontSize: 13, cursor: "pointer",
                }}
              >
                {firstName ? firstName[0].toUpperCase() : "?"}
              </button>
            </div>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: colors.textLight, margin: "0 0 4px" }}>Merhaba{firstName ? `, ${firstName}` : ""}</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0 }}>Aracınızın tüm geçmişi tek ekranda.</p>
        </div>
      </div>

      <div className="otoiz-dashboard-container" style={{ maxWidth: 480, margin: "-14px auto 0", padding: "0 16px 24px" }}>
        {vehicles.length > 1 && (
          <input
            placeholder="Plaka ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: radius.md, border: `1px solid ${colors.border}`,
              marginBottom: 16, fontSize: 15, fontFamily: font, background: colors.surfaceLight,
              boxShadow: "0 8px 24px rgba(6,20,33,0.1)",
            }}
          />
        )}

        {pendingTransfers.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 13, color: colors.textMuted, marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
              Bekleyen Devirler
            </h2>
            {pendingTransfers.map((t) => (
              <div key={t.transfer_token} style={{ background: "#FFF8E6", border: "1px solid #E8C468", borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#7a5c10" }}>{t.plate}</div>
                <div style={{ fontSize: 12, color: "#7a5c10", marginBottom: 10 }}>
                  {t.brand} {t.model} — yeni sahibin kabul etmesi bekleniyor
                </div>
                <button
                  onClick={() => handleCancelTransfer(t.transfer_token)}
                  disabled={cancelling === t.transfer_token}
                  style={{ fontSize: 12, padding: "8px 14px", background: "#fff", border: "1px solid #E8C468", borderRadius: 8, color: "#7a5c10", fontWeight: 600, cursor: "pointer", minHeight: 36 }}
                >
                  {cancelling === t.transfer_token ? "İptal ediliyor…" : "Devri İptal Et, Aracı Geri Al"}
                </button>
              </div>
            ))}
          </section>
        )}

        {vehicles.length === 0 ? (
          <div style={{ background: colors.surfaceLight, borderRadius: radius.lg, padding: "40px 20px", textAlign: "center", boxShadow: "0 8px 24px rgba(6,20,33,0.08)" }}>
            <p style={{ color: colors.textMuted, marginBottom: 18, fontSize: 14 }}>Henüz araç eklemediniz.</p>
            <a
              href="/bireysel/araclar/yeni"
              style={{ display: "inline-block", padding: "12px 22px", background: colors.green, color: colors.textDark, borderRadius: radius.sm, textDecoration: "none", fontWeight: 700, minHeight: 44 }}
            >
              + Yeni Araç Ekle
            </a>
          </div>
        ) : (
          <>
            {primary && <VehicleHeroCard vehicle={primary} onClick={() => router.push(`/bireysel/araclar/${primary.id}`)} />}

            {primary && (
              <section className="otoiz-dashboard-modules" style={{ marginTop: 18, marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                {MODULES.map((m) => (
                  <a
                    key={m.key}
                    href={`/bireysel/araclar/${primary.id}#${m.key}`}
                    className="otoiz-module-card"
                    style={{
                      display: "flex", alignItems: "center", gap: 14, background: colors.surfaceLight,
                      border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: "16px 18px",
                      textDecoration: "none", minHeight: 44, boxShadow: "0 6px 18px rgba(6,20,33,0.09)",
                    }}
                  >
                    <div style={{ width: 44, height: 44, minWidth: 44, borderRadius: "50%", background: "#E6FAEE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name={m.icon} color={colors.greenDark} size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.textDark, marginBottom: 2 }}>{m.title}</div>
                      <div style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.4 }}>{m.desc}</div>
                    </div>
                    <Icon name="chevron-right" color={colors.textMuted} size={18} />
                  </a>
                ))}
              </section>
            )}

            <a
              href="/bireysel/araclar/yeni"
              style={{ display: "block", textAlign: "center", padding: "13px 20px", background: colors.surfaceLight, color: colors.textDark, border: `1.5px solid ${colors.border}`, borderRadius: radius.sm, textDecoration: "none", fontWeight: 700, marginBottom: 20, minHeight: 44 }}
            >
              + Yeni Araç Ekle
            </a>

            {rest.length > 0 && (
              <section>
                <h2 style={{ fontSize: 13, color: colors.textMuted, marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
                  Diğer Araçlarım
                </h2>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {rest.map((v) => (
                    <li key={v.id} style={{ background: colors.surfaceLight, borderRadius: radius.md, border: `1px solid ${colors.border}`, marginBottom: 8 }}>
                      <a href={`/bireysel/araclar/${v.id}`} style={{ display: "block", textDecoration: "none", color: colors.textDark, padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{v.plate}</div>
                        <div style={{ color: colors.textMuted, fontSize: 12.5 }}>
                          {v.brand} {v.model} · {v.current_km?.toLocaleString("tr-TR")} km
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {filtered.length === 0 && vehicles.length > 0 && (
          <p style={{ color: colors.textMuted, marginTop: 20, textAlign: "center", fontSize: 14 }}>Araç bulunamadı.</p>
        )}

        <button onClick={handleLogout} style={{ display: "block", margin: "28px auto 0", background: "none", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: 13, minHeight: 44, padding: "0 16px" }}>
          Çıkış yap
        </button>
      </div>

      <BottomNav active="home" />
    </main>
  );
}

function VehicleHeroCard({ vehicle, onClick }: { vehicle: any; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="otoiz-hero-pattern"
      style={{
        width: "100%", textAlign: "left", position: "relative", overflow: "hidden",
        background: `linear-gradient(160deg, ${colors.surfaceDark}, ${colors.bg})`, borderRadius: radius.xl, padding: 20,
        border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: colors.textLight, boxShadow: "0 16px 38px rgba(6,20,33,0.28)",
      }}
    >
      {/* Onaylanan OTOİZ referans fotoğrafı — kart içi görsel araç vurgusu */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: "url(/marketing/otoiz-hero-car.jpg)",
          backgroundSize: "cover", backgroundPosition: "70% 40%",
          opacity: 0.4,
          WebkitMaskImage: "linear-gradient(105deg, transparent 0%, transparent 30%, black 62%, black 100%)",
          maskImage: "linear-gradient(105deg, transparent 0%, transparent 30%, black 62%, black 100%)",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: 0.5 }}>{vehicle.plate}</div>
          <div style={{ fontSize: 13, opacity: 0.65, marginTop: 2 }}>
            {vehicle.brand} {vehicle.model}{vehicle.year ? ` · ${vehicle.year}` : ""}
          </div>
        </div>
        <div style={{ background: "rgba(54,232,109,0.14)", color: colors.green, fontSize: 10.5, fontWeight: 700, padding: "5px 11px", borderRadius: 999, border: "1px solid rgba(54,232,109,0.35)" }}>
          Aktif Pasaport
        </div>
      </div>
      <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 12, padding: "11px 13px", backdropFilter: "blur(2px)" }}>
          <div style={{ fontSize: 10, opacity: 0.55, marginBottom: 2 }}>GÜNCEL KM</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{vehicle.current_km != null ? Number(vehicle.current_km).toLocaleString("tr-TR") : "—"}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 12, padding: "11px 13px", backdropFilter: "blur(2px)" }}>
          <div style={{ fontSize: 10, opacity: 0.55, marginBottom: 2 }}>SONRAKİ BAKIM</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: colors.green }}>
            {describeMaintenancePlan({ nextServiceKm: vehicle.next_service_km, nextServiceDate: vehicle.next_service_date }).label}
          </div>
        </div>
      </div>
    </button>
  );
}
