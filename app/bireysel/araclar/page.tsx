"use client";

// OTOİZ — Bireysel ana ekran (Nihai UX mimarisi, kapalı tasarım).
// Yukarıdan aşağı tek okuma sırası:
//  A) Araç kimliği: plaka, marka/model/yıl, güncel km, küçük "Araç Değiştir"
//  B) Kritik özet: kaç işlem dikkat bekliyor + en önemli iki işlem
//  C) Bakım · Muayene · Kasko · Trafik Sigortası (masaüstü tek satır, mobil 2x2)
//  D) Yaklaşan İşlemler + Son Kayıtlar (masaüstü 2 sütun, mobil alt alta)
//  E) QR: bağlı değilse tek kompakt aksiyon kartı
// Veri erişimi değişmedi (vehicles, qr_keys, maintenance_items,
// vehicle_timeline); yeni yazma yok.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { fetchStatusRecords } from "@/lib/vehicleRecords";
import { colors, font, radius, cardStyle, primaryButtonStyle, secondaryButtonStyle } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { OtoizLogo } from "@/components/OtoizLogo";
import { BottomNav } from "@/components/BottomNav";
import { InstallCta } from "@/components/InstallCta";
import { AuthShellLoading } from "@/components/AuthShell";
import { StatusQuad, StatusPill, STATUS_TONE, vehicleStatusFor } from "@/components/VehicleStatusPanel";
import { VehicleTimeline } from "@/components/VehicleTimeline";
import { PILOT_FLAGS } from "@/lib/pilotFlags";

const { ITEM_LABELS } = require("@/lib/maintenanceItems");
const { criticalSummary } = require("@/lib/vehicleStatus");

const ACTIVE_KEY = "otoiz-aktif-arac";

type QrState = "loading" | "active" | "revoked" | "none";

function readActive(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}
function writeActive(id: string) {
  try {
    window.localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // tarayıcı depolaması kapalıysa seçim yalnız bu oturumda kalır
  }
}

export default function BireyselAraclarPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [statusRecords, setStatusRecords] = useState<{ lastMuayene: any; lastDetailing: any }>({ lastMuayene: null, lastDetailing: null });
  const [qr, setQr] = useState<QrState>("loading");
  const [switcherOpen, setSwitcherOpen] = useState(false);

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

  async function loadVehicles(userId: string) {
    const { data: vehicleList, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });
    if (error) setLoadError(true);
    const list = vehicleList ?? [];
    setVehicles(list);
    const stored = readActive();
    setActiveId((prev) => {
      const want = prev ?? stored;
      return list.some((v: any) => v.id === want) ? want : list[0]?.id ?? null;
    });
  }

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/bireysel/giris");
        return;
      }
      setEmail(session.session.user.email ?? null);
      await loadVehicles(session.session.user.id);
      await loadPendingTransfers();
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aktif aracın durum verisi (bakım kalemleri, son muayene/detailing, QR).
  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    setQr("loading");
    (async () => {
      const [mi, sr, qk] = await Promise.all([
        supabase.from("maintenance_items").select("*").eq("vehicle_id", activeId),
        fetchStatusRecords(supabase, activeId),
        supabase.from("qr_keys").select("code, revoked_at").eq("vehicle_id", activeId).limit(20),
      ]);
      if (!alive) return;
      setItems(mi.data ?? []);
      setStatusRecords(sr);
      const keys: any[] = Array.isArray(qk.data) ? qk.data : qk.data ? [qk.data] : [];
      setQr(keys.some((k) => !k.revoked_at) ? "active" : keys.length > 0 ? "revoked" : "none");
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  async function handleCancelTransfer(transferId: string) {
    setCancelling(transferId);
    const { error } = await supabase.rpc("cancel_ownership_transfer", { p_transfer_id: transferId });
    setCancelling(null);
    if (error) {
      alert("İptal edilemedi. Sayfayı yenileyip tekrar deneyin.");
      return;
    }
    await loadPendingTransfers();
    const { data: session } = await supabase.auth.getSession();
    if (session.session) await loadVehicles(session.session.user.id);
  }

  async function handleLogout() {
    await supabase.auth.signOut({ scope: "local" });
    router.push("/bireysel/giris");
  }

  function selectVehicle(id: string) {
    setActiveId(id);
    writeActive(id);
    setSwitcherOpen(false);
  }

  const active = vehicles.find((v) => v.id === activeId) ?? null;
  const status = useMemo(
    () => (active ? vehicleStatusFor(active, items, ITEM_LABELS, statusRecords.lastMuayene, statusRecords.lastDetailing) : null),
    [active, items, statusRecords]
  );
  const firstName = email ? email.split("@")[0] : "";

  if (loading) {
    return <AuthShellLoading />;
  }

  // Eksik bilgi: km, bakım planı veya belge tarihlerinden biri boşsa.
  const missing: string[] = [];
  if (active) {
    if (active.current_km == null || active.current_km === "") missing.push("kilometre");
    if (!active.next_service_km && !active.next_service_date) missing.push("bakım planı");
    if (!active.muayene_tarihi) missing.push("muayene tarihi");
    if (!active.kasko_bitis) missing.push("kasko bitişi");
    if (!active.trafik_sigortasi_bitis) missing.push("trafik sigortası bitişi");
  }

  return (
    <main className="otoiz-app-shell otoiz-has-bottom-nav" style={{ fontFamily: font }}>
      {/* 1) Üst başlık */}
      <header style={{ background: `linear-gradient(180deg, ${colors.bgAlt} 0%, ${colors.bg} 100%)`, borderBottom: `1px solid ${colors.border}` }}>
        <div className="otoiz-page otoiz-page-wide" style={{ paddingTop: 12, paddingBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <OtoizLogo variant="dark" size={116} />
            {/* Masaüstünde üstteki gezinme çubuğu aynı bağlantıları taşır;
                üst üste binmesin diye bu iki düğme yalnız mobilde. */}
            <div className="otoiz-mobile-only" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => router.push("/bireysel/bildirimler")}
                aria-label="Bildirimler"
                style={{ position: "relative", width: 44, height: 44, borderRadius: "50%", background: colors.surfaceRaised, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <Icon name="bell" color={colors.text} size={18} />
                {pendingTransfers.length > 0 && <span style={{ position: "absolute", top: 9, right: 10, width: 7, height: 7, borderRadius: "50%", background: colors.green }} />}
              </button>
              <button
                onClick={() => router.push("/bireysel/profil")}
                aria-label="Profil"
                style={{ width: 44, height: 44, borderRadius: "50%", background: colors.surfaceRaised, border: `1px solid ${colors.border}`, color: colors.greenLight, fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: font }}
              >
                {firstName ? firstName[0].toLocaleUpperCase("tr-TR") : "?"}
              </button>
            </div>
          </div>

          {active ? (
            <section aria-label="Araç kimliği" data-testid="arac-kimligi">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px 12px", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <h1 data-testid="aktif-plaka" style={{ fontSize: 24, fontWeight: 800, letterSpacing: 0.6, color: colors.text, margin: 0, lineHeight: 1.15, whiteSpace: "nowrap" }}>
                    {active.plate}
                  </h1>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 12px", marginTop: 4 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: colors.textMuted }}>
                      {[active.brand, active.model].filter(Boolean).join(" ") || "Marka/model girilmedi"}
                      {active.year ? ` · ${active.year}` : ""}
                    </span>
                    {active.current_km != null && active.current_km !== "" && (
                      <span data-testid="aktif-km" style={{ fontSize: 14.5, fontWeight: 700, color: colors.text }}>{Number(active.current_km).toLocaleString("tr-TR")} km</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="arac-degistir"
                  aria-expanded={switcherOpen}
                  aria-controls="arac-secici"
                  onClick={() => setSwitcherOpen((v) => !v)}
                  style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 2px", border: "none", background: "transparent", color: colors.textMuted, fontSize: 13.5, fontWeight: 600, fontFamily: font, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "underline", textDecorationColor: colors.border, textUnderlineOffset: 4 }}
                >
                  <Icon name="swap" color={colors.textFaint} size={14} />
                  Araç Değiştir
                </button>
              </div>
              {switcherOpen && (
                <div id="arac-secici" data-testid="arac-secici" className="otoiz-enter" style={{ marginTop: 14, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 6 }}>
                  <div role="listbox" aria-label="Araç seçin">
                    {vehicles.map((v) => {
                      const on = v.id === activeId;
                      return (
                        <button
                          key={v.id}
                          role="option"
                          aria-selected={on}
                          onClick={() => selectVehicle(v.id)}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", minHeight: 48, padding: "8px 12px", borderRadius: radius.sm, border: "none", background: on ? colors.surfaceRaised : "transparent", color: colors.text, fontFamily: font, cursor: "pointer", textAlign: "left" }}
                        >
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 15, fontWeight: 800, letterSpacing: 0.4 }}>{v.plate}</span>
                            <span style={{ display: "block", fontSize: 12.5, color: colors.textMuted }}>{[v.brand, v.model].filter(Boolean).join(" ")}</span>
                          </span>
                          {on && <Icon name="check" color={colors.green} size={18} />}
                        </button>
                      );
                    })}
                  </div>
                  <a href="/bireysel/araclar/yeni" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "8px 12px", borderTop: `1px solid ${colors.border}`, marginTop: 4, color: colors.text, fontSize: 14.5, fontWeight: 700, textDecoration: "none" }}>
                    <Icon name="plus-square" color={colors.textMuted} size={18} />
                    Başka Araç Ekle
                  </a>
                </div>
              )}
            </section>
          ) : (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: colors.text, margin: 0 }}>Aracınızı ekleyin</h1>
              <p style={{ fontSize: 14, color: colors.textMuted, margin: "8px 0 0", lineHeight: 1.5 }}>Bakım, muayene ve sigorta tarihlerini tek yerden takip edin.</p>
            </>
          )}
        </div>
      </header>

      <div className="otoiz-page otoiz-page-wide" style={{ paddingTop: 20, paddingBottom: 28 }}>
        {loadError && (
          <p role="alert" style={{ ...cardStyle, borderColor: colors.danger, color: colors.text, fontSize: 14, margin: "0 0 20px" }}>
            Araçlarınız yüklenemedi. Bağlantınızı kontrol edip sayfayı yenileyin.
          </p>
        )}

        {pendingTransfers.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <SectionTitle>Bekleyen Devirler</SectionTitle>
            {pendingTransfers.map((t) => (
              <div key={t.transfer_id} style={{ ...cardStyle, borderColor: colors.warning, marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: colors.text }}>{t.plate}</div>
                <div style={{ fontSize: 13, color: colors.textMuted, margin: "4px 0 12px" }}>
                  {t.brand} {t.model} · {t.expired ? "devir bağlantısının süresi doldu; aracı geri alabilirsiniz" : "yeni sahibin kabul etmesi bekleniyor"}
                </div>
                <button onClick={() => handleCancelTransfer(t.transfer_id)} disabled={cancelling === t.transfer_id} style={secondaryButtonStyle()}>
                  {cancelling === t.transfer_id ? "İptal ediliyor…" : "Devri İptal Et, Aracı Geri Al"}
                </button>
              </div>
            ))}
          </section>
        )}

        {!active ? (
          <div className="otoiz-stack otoiz-enter">
            <section data-testid="birincil-aksiyon" style={{ ...cardStyle, padding: "28px 20px", textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: radius.md, background: colors.greenSoft, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <Icon name="car" color={colors.greenLight} size={26} />
              </div>
              <h2 style={{ fontSize: 19, fontWeight: 800, color: colors.text, margin: "0 0 6px" }}>Henüz araç eklemediniz</h2>
              <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 20px", lineHeight: 1.5 }}>Plaka, marka, model, model yılı ve kilometreyle başlayın; tarihleri sonra da ekleyebilirsiniz.</p>
              <a href="/bireysel/araclar/yeni" style={{ ...primaryButtonStyle(false), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                Aracımı Ekle
              </a>
              <a href="/aktivasyon" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, marginTop: 8, color: colors.textMuted, fontSize: 14, fontWeight: 600 }}>
                OTOİZ anahtarlığım var, etkinleştir
              </a>
            </section>
            <InstallCta tone="light" />
          </div>
        ) : (
          <div className="otoiz-stack otoiz-enter">
            {/* B) Kritik özet */}
            {status && <CriticalSummary status={status} vehicleId={active.id} missing={missing} />}

            {/* C) Dört durum kartı */}
            <section aria-label="Araç durumu">
              <SectionTitle
                action={
                  <a href={`/bireysel/araclar/${active.id}`} style={linkStyle}>
                    Araç detayı
                  </a>
                }
              >
                Araç Durumu
              </SectionTitle>
              {status && <StatusQuad cards={status.cards} />}
            </section>

            {/* D) Yaklaşan İşlemler + Son Kayıtlar */}
            <div className="otoiz-two-col">
              <section aria-label="Yaklaşan işlemler" data-testid="yaklasan-islemler" style={cardStyle}>
                <h2 style={cardTitle}>Yaklaşan İşlemler</h2>
                {status && status.upcoming.length > 0 ? (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    {status.upcoming.slice(0, 4).map((u: any) => (
                      <li key={u.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: colors.surfaceRaised, borderRadius: radius.sm, padding: "12px 14px" }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: colors.text }}>{u.title}</span>
                          <span style={{ display: "block", fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{u.detail}</span>
                        </span>
                        <StatusPill level={u.level} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: 14, color: colors.textMuted, margin: 0, lineHeight: 1.5 }}>
                    {status && status.cards.find((c: any) => c.key === "yaklasan")?.level === "ok"
                      ? "Önümüzdeki 30 gün / 1.000 km içinde işlem görünmüyor."
                      : "Tarih ve bakım planı girildiğinde yaklaşan işlemler burada listelenir."}
                  </p>
                )}
              </section>

              <VehicleTimeline
                supabase={supabase}
                vehicleId={active.id}
                audience="bireysel"
                preview={3}
                title="Son Kayıtlar"
                alwaysShowAll
                onShowAll={() => router.push(`/bireysel/araclar/${active.id}#servis-gecmisi`)}
              />
            </div>

            {/* E) QR */}
            <QrCard vehicleId={active.id} qr={qr} />

            <InstallCta tone="light" />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginTop: 24 }}>
          <a href="/bireysel/gorus" style={{ ...linkStyle, color: colors.textMuted }}>Görüş Bildir</a>
          <button onClick={handleLogout} style={{ ...linkStyle, color: colors.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: font }}>
            Çıkış yap
          </button>
        </div>
      </div>

      <BottomNav active="home" />
    </main>
  );
}

const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  padding: "0 10px",
  fontSize: 14,
  fontWeight: 700,
  color: colors.greenLight,
  textDecoration: "none",
};

const cardTitle: React.CSSProperties = { fontSize: 17, fontWeight: 800, color: colors.text, margin: "0 0 14px" };

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: colors.text, margin: 0 }}>{children}</h2>
      {action}
    </div>
  );
}

// B) Kritik özet — dikkat bekleyen işlem sayısı ve en önemli iki işlem.
// Eksik bilgi varsa tek küçük bağlantı; büyük yeşil yüzey yok.
function CriticalSummary({ status, vehicleId, missing }: { status: any; vehicleId: string; missing: string[] }) {
  const s = criticalSummary(status);
  const t = STATUS_TONE[s.level] ?? STATUS_TONE.none;
  const icon = s.level === "late" || s.level === "soon" ? "alert" : s.level === "ok" ? "check" : "clipboard";
  return (
    <section data-testid="kritik-ozet" data-level={s.level} aria-label="Kritik özet" style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div aria-hidden="true" style={{ width: 4, flex: "0 0 4px", background: t.dot }} />
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px 18px", flex: 1, minWidth: 0 }}>
          <div aria-hidden="true" style={{ width: 40, height: 40, minWidth: 40, borderRadius: radius.sm, background: colors.surfaceRaised, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={icon} color={s.level === "none" ? colors.textMuted : t.dot} size={20} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: colors.text, margin: 0, lineHeight: 1.3 }}>{s.title}</h2>
            <p style={{ fontSize: 14, color: colors.textMuted, margin: "4px 0 0", lineHeight: 1.45 }}>{s.line}</p>
            {missing.length > 0 && (
              <a href={`/bireysel/araclar/${vehicleId}#duzenle`} data-testid="eksik-bilgi" style={{ ...linkStyle, padding: 0, minHeight: 36, marginTop: 4, color: colors.text }}>
                Eksik bilgileri tamamla ({missing.length})
                <Icon name="chevron-right" color={colors.textMuted} size={16} />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// E) QR — tek kompakt kart. Bağlı değilse yalnız "Anahtarlığı Etkinleştir".
function QrCard({ vehicleId, qr }: { vehicleId: string; qr: QrState }) {
  if (qr === "loading") return null;
  const map: Record<Exclude<QrState, "loading">, { title: string; cta: { href: string; label: string }; level: string }> = {
    none: { title: "OTOİZ anahtarlığı henüz bağlı değil", cta: { href: "/aktivasyon", label: "Anahtarlığı Etkinleştir" }, level: "none" },
    active: { title: "OTOİZ anahtarlık bağlı", cta: { href: `/bireysel/araclar/${vehicleId}#anahtarlik`, label: "Ayrıntılar" }, level: "ok" },
    revoked: { title: "Anahtarlık iptal edildi", cta: { href: "/aktivasyon", label: "Yeni ürünü etkinleştir" }, level: "late" },
  };
  const m = map[qr];
  return (
    <section data-testid="qr-durumu" data-state={qr} aria-label="QR anahtarlık" style={{ ...cardStyle, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div aria-hidden="true" style={{ width: 40, height: 40, minWidth: 40, borderRadius: radius.sm, background: colors.surfaceRaised, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="qr" color={qr === "active" ? colors.green : colors.textMuted} size={20} />
        </div>
        <div style={{ flex: "1 1 180px", minWidth: 0, fontSize: 15, fontWeight: 700, color: colors.text }}>
          {m.title}
          {qr === "active" && (
            <span data-testid="qr-aktif" style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: colors.greenLight, border: `1px solid rgba(34,197,94,0.5)`, borderRadius: radius.pill, padding: "2px 9px", verticalAlign: "2px" }}>
              Aktif
            </span>
          )}
        </div>
        <a href={m.cta.href} style={{ ...linkStyle, padding: 0, color: qr === "none" ? colors.greenLight : colors.text }}>
          {m.cta.label}
          <Icon name="chevron-right" color={qr === "none" ? colors.greenLight : colors.textMuted} size={16} />
        </a>
      </div>
    </section>
  );
}
