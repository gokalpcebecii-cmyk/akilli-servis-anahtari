"use client";

// OTOİZ — Bireysel ana ekran (pilot öncesi son cila, kapalı tasarım).
// Yukarıdan aşağı tek okuma sırası:
//  1) Üst başlık: karşılama, aktif araç (plaka / marka-model), kısa alt metin,
//     birden çok araç varsa sade araç seçici
//  2) Birincil aksiyon: kullanıcının durumuna göre TEK net adım
//     (Aracımı Ekle · QR'ı Etkinleştir · Eksik Bilgileri Tamamla)
//  3) Araç Durumu: Bakım / Muayene / Kasko / Trafik sigortası (4 mini kart)
//  4) QR Durumu kartı
//  5) Yaklaşan işlemler
//  6) Son kayıtlar (son 3 olay) + "Tüm geçmişi gör"
// Veri erişimi önceki ekranla aynı (vehicles, qr_keys, maintenance_items,
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
import { StatusQuad, StatusPill, vehicleStatusFor } from "@/components/VehicleStatusPanel";
import { VehicleTimeline } from "@/components/VehicleTimeline";
import { PILOT_FLAGS } from "@/lib/pilotFlags";

const { ITEM_LABELS } = require("@/lib/maintenanceItems");

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
        <div className="otoiz-page otoiz-page-wide" style={{ paddingTop: 16, paddingBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
            <OtoizLogo variant="dark" size={128} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

          <p style={{ fontSize: 15, color: colors.textMuted, margin: "0 0 6px", fontWeight: 600 }}>Merhaba{firstName ? `, ${firstName}` : ""}</p>
          {active ? (
            <>
              <h1 data-testid="aktif-plaka" style={{ fontSize: 30, fontWeight: 800, letterSpacing: 0.8, color: colors.text, margin: 0, lineHeight: 1.15 }}>
                {active.plate}
              </h1>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 12px", marginTop: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>
                  {[active.brand, active.model].filter(Boolean).join(" ") || "Marka/model girilmedi"}
                  {active.year ? ` · ${active.year}` : ""}
                </span>
                {active.current_km != null && active.current_km !== "" && (
                  <span style={{ fontSize: 15, fontWeight: 700, color: colors.greenLight }}>{Number(active.current_km).toLocaleString("tr-TR")} km</span>
                )}
              </div>
              <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: colors.textFaint, margin: "12px 0 0" }}>
                <Icon name="shield-check" color={colors.textFaint} size={15} />
                Bakım, muayene ve sigorta tarihleri tek ekranda.
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: colors.text, margin: 0 }}>Aracınızı ekleyin</h1>
              <p style={{ fontSize: 14, color: colors.textMuted, margin: "8px 0 0", lineHeight: 1.5 }}>Bakım, muayene ve sigorta tarihlerini tek yerden takip edin.</p>
            </>
          )}

          {vehicles.length > 1 && (
            <div role="tablist" aria-label="Araç seçin" data-testid="arac-secici" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "16px -16px 0", padding: "2px 16px", scrollbarWidth: "none" }}>
              {vehicles.map((v) => {
                const on = v.id === activeId;
                return (
                  <button
                    key={v.id}
                    role="tab"
                    aria-selected={on}
                    onClick={() => selectVehicle(v.id)}
                    style={{
                      flex: "0 0 auto", minHeight: 44, padding: "0 16px", borderRadius: radius.pill, cursor: "pointer", fontFamily: font,
                      fontSize: 14, fontWeight: 700, letterSpacing: 0.4, whiteSpace: "nowrap",
                      border: `1px solid ${on ? colors.green : colors.border}`,
                      background: on ? colors.greenSoft : colors.surfaceRaised,
                      color: on ? colors.greenLight : colors.textMuted,
                    }}
                  >
                    {v.plate}
                  </button>
                );
              })}
            </div>
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
              <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 20px", lineHeight: 1.5 }}>Plaka ve kilometreyle başlayın; diğer bilgileri sonra ekleyebilirsiniz.</p>
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
          <div className="otoiz-home-grid otoiz-stack otoiz-enter">
            <div className="otoiz-stack">
              {/* 2) Birincil aksiyon */}
              <PrimaryAction vehicle={active} qr={qr} missing={missing} />

              {/* 3) Araç Durumu */}
              <section aria-label="Araç durumu">
                <SectionTitle
                  action={
                    <a href={`/bireysel/araclar/${active.id}`} style={linkStyle}>
                      Detay
                    </a>
                  }
                >
                  Araç Durumu
                </SectionTitle>
                {status && <StatusQuad cards={status.cards} />}
              </section>

              {/* 5) Yaklaşan işlemler */}
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
            </div>

            <div className="otoiz-stack">
              {/* 4) QR Durumu */}
              <QrCard vehicleId={active.id} qr={qr} />

              {/* 6) Son kayıtlar */}
              <VehicleTimeline
                supabase={supabase}
                vehicleId={active.id}
                audience="bireysel"
                preview={3}
                title="Son Kayıtlar"
                alwaysShowAll
                onShowAll={() => router.push(`/bireysel/araclar/${active.id}#servis-gecmisi`)}
              />

              <InstallCta tone="light" />

              <a href="/bireysel/araclar/yeni" style={{ ...secondaryButtonStyle(), display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none" }}>
                <Icon name="plus-square" color={colors.text} size={18} />
                Başka Araç Ekle
              </a>
            </div>
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

// Kullanıcının o anki tek net adımı. Öncelik: QR bağlı değilse etkinleştir,
// sonra eksik bilgi. İkisi de tamamsa kart görünmez (ekran sadeleşir).
function PrimaryAction({ vehicle, qr, missing }: { vehicle: any; qr: QrState; missing: string[] }) {
  let title = "";
  let text = "";
  let href = "";
  let cta = "";
  let secondary: { href: string; label: string } | null = null;
  if (qr === "none") {
    title = "QR anahtarlığınızı etkinleştirin";
    text = "Anahtarlığın arkasındaki seri no ve kodla aracınıza bağlayın.";
    href = "/aktivasyon";
    cta = "QR'ı Etkinleştir";
    if (missing.length > 0) secondary = { href: `/bireysel/araclar/${vehicle.id}#duzenle`, label: "Eksik Bilgileri Tamamla" };
  } else if (missing.length > 0) {
    title = "Eksik bilgiler var";
    text = `Durumların doğru görünmesi için ekleyin: ${missing.join(", ")}.`;
    href = `/bireysel/araclar/${vehicle.id}#duzenle`;
    cta = "Eksik Bilgileri Tamamla";
  } else {
    return null;
  }
  return (
    <section data-testid="birincil-aksiyon" style={{ ...cardStyle, borderColor: "rgba(34,197,94,0.45)", background: `linear-gradient(160deg, rgba(34,197,94,0.10) 0%, ${colors.surface} 55%)` }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: colors.text, margin: "0 0 6px" }}>{title}</h2>
      <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 16px", lineHeight: 1.5 }}>{text}</p>
      <a href={href} style={{ ...primaryButtonStyle(false), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
        {cta}
      </a>
      {secondary && (
        <a href={secondary.href} style={{ ...secondaryButtonStyle(), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", marginTop: 10 }}>
          {secondary.label}
        </a>
      )}
    </section>
  );
}

function QrCard({ vehicleId, qr }: { vehicleId: string; qr: QrState }) {
  const map: Record<QrState, { label: string; kind: "ok" | "late" | "none"; text: string; cta?: { href: string; label: string } }> = {
    loading: { label: "Kontrol ediliyor", kind: "none", text: "QR durumu yükleniyor…" },
    active: { label: "Aktif", kind: "ok", text: "QR okutulduğunda aracın dijital pasaportu açılır.", cta: { href: `/bireysel/araclar/${vehicleId}#anahtarlik`, label: "QR ayrıntıları" } },
    none: { label: "Bağlı değil", kind: "none", text: "Bu araca bağlı bir QR anahtarlık yok.", cta: { href: "/aktivasyon", label: "QR'ı Etkinleştir" } },
    revoked: { label: "İptal edildi", kind: "late", text: "Bu aracın QR'ı iptal edildi. Yeni bir OTOİZ ürünü gerekir.", cta: { href: "/aktivasyon", label: "Yeni ürünü etkinleştir" } },
  };
  const m = map[qr];
  const pill = { ok: { bg: colors.green, fg: colors.onAccent }, late: { bg: colors.danger, fg: "#FFFFFF" }, none: { bg: colors.neutralSoft, fg: colors.textMuted } }[m.kind];
  return (
    <section data-testid="qr-durumu" data-state={qr} aria-label="QR durumu" style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, minWidth: 44, borderRadius: radius.md, background: colors.surfaceRaised, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="qr" color={qr === "active" ? colors.greenLight : colors.textMuted} size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.textMuted }}>QR Durumu</div>
          <span style={{ display: "inline-block", marginTop: 4, fontSize: 12, fontWeight: 700, color: pill.fg, background: pill.bg, borderRadius: radius.pill, padding: "3px 10px" }}>{m.label}</span>
        </div>
      </div>
      <p style={{ fontSize: 14, color: colors.textMuted, margin: "12px 0 0", lineHeight: 1.5 }}>{m.text}</p>
      {m.cta && (
        <a href={m.cta.href} style={{ ...linkStyle, padding: 0, marginTop: 6 }}>
          {m.cta.label}
          <Icon name="chevron-right" color={colors.greenLight} size={16} />
        </a>
      )}
    </section>
  );
}
