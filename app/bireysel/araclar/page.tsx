"use client";

// OTOİZ Premium — bireysel ana deneyim = DİJİTAL KOKPİT (2026-10-05 kapalı
// tasarım). Tek merkez: alt gezinmedeki 5 bölüm (Ana Sayfa, Aracım,
// Belgeler, Bakım, Diğer) aynı sayfada değişir (?bolum=); yaklaşan bakım ve
// muayene alt pencerede açılır, kullanıcı başka sayfaya savrulmaz.
// Veri erişimi değişmedi (vehicles, maintenance_items, vehicle_timeline RPC,
// /api/belgeler + sunucuda imzalı bağlantı); yeni yazma yolu yok — kayıt
// ekleme mevcut "İşlem Ekle" penceresiyle (QuickActionSheet) yapılır.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { fetchStatusRecords } from "@/lib/vehicleRecords";
import { Icon } from "@/components/Icon";
import { OtoizLogo } from "@/components/OtoizLogo";
import { BottomNav, DesktopNav, type NavKey } from "@/components/BottomNav";
import { InstallCta } from "@/components/InstallCta";
import { AuthShellLoading } from "@/components/AuthShell";
import { vehicleStatusFor } from "@/components/VehicleStatusPanel";
import OwnerKeychainCard from "@/components/OwnerKeychainCard";
import { QuickActionSheet, SuccessToast, useVehicleDocuments, DocumentDeleteDialog, type QuickStep } from "@/components/QuickActionHub";
import { CarHero, StatCard, Tile, SectionHead, Chips, RingGauge, BottomSheet, useTimeline, TimelineList, Skeleton } from "@/components/Premium";
import { PILOT_FLAGS } from "@/lib/pilotFlags";

const { ITEM_LABELS } = require("@/lib/maintenanceItems");
const { fmtDate, dateDueStatus, itemStatus } = require("@/lib/vehicleStatus");
const { todayIsoIstanbul } = require("@/lib/logic");
const { DOC_TYPE_LABELS, fmtSize } = require("@/lib/quickActions");
const {
  sectionFrom,
  fmtKm,
  remainingPhrase,
  approxPhrase,
  maintenanceWord,
  ringFraction,
  filterTimeline,
  lastServiceRecord,
  DOC_FILTERS,
  filterDocuments,
  docCountPhrase,
  muayeneView,
} = require("@/lib/premiumUi");

const ACTIVE_KEY = "otoiz-aktif-arac";

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

const TL_FILTERS = [
  { key: "tumu", label: "Tümü" },
  { key: "servis", label: "Servis" },
  { key: "kullanici", label: "Kullanıcı" },
];

export default function BireyselAraclarPage() {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserSupabase());
  const [section, setSection] = useState<NavKey>("ana");
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [statusRecords, setStatusRecords] = useState<{ lastMuayene: any; lastDetailing: any }>({ lastMuayene: null, lastDetailing: null });
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [sheet, setSheet] = useState<null | "yaklasan" | "muayene">(null);
  const [qaOpen, setQaOpen] = useState(false);
  const [qaStep, setQaStep] = useState<QuickStep>("menu");
  const [toast, setToast] = useState("");
  const [tlReload, setTlReload] = useState(0);
  const [docsReload, setDocsReload] = useState(0);
  const [tlFilter, setTlFilter] = useState("tumu");
  const [docFilter, setDocFilter] = useState("tumu");

  const timeline = useTimeline(supabase, activeId, 20, tlReload);
  const documents = useVehicleDocuments(supabase, activeId, docsReload);

  // Bölüm adresi: ?bolum=aracim … (geri tuşu bir önceki bölüme döner).
  useEffect(() => {
    const read = () => setSection(sectionFrom(new URLSearchParams(window.location.search).get("bolum")));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  function go(next: NavKey) {
    setSwitcherOpen(false);
    if (next !== section) {
      const url = next === "ana" ? window.location.pathname : `${window.location.pathname}?bolum=${next}`;
      window.history.pushState(null, "", url);
      setSection(next);
    }
    window.scrollTo({ top: 0 });
  }

  async function loadPendingTransfers() {
    if (!PILOT_FLAGS.ownershipTransferSelfService) {
      setPendingTransfers([]);
      return;
    }
    const { data } = await supabase.rpc("list_my_pending_outgoing_transfers");
    setPendingTransfers(data ?? []);
  }

  async function loadVehicles(uid: string) {
    const { data: vehicleList, error } = await supabase.from("vehicles").select("*").eq("owner_user_id", uid).order("created_at", { ascending: false });
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
      setUserId(session.session.user.id);
      await loadVehicles(session.session.user.id);
      await loadPendingTransfers();
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadActiveData(id: string) {
    const [mi, sr] = await Promise.all([supabase.from("maintenance_items").select("*").eq("vehicle_id", id), fetchStatusRecords(supabase, id)]);
    return { items: mi.data ?? [], sr };
  }

  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    loadActiveData(activeId).then(({ items: it, sr }) => {
      if (!alive) return;
      setItems(it);
      setStatusRecords(sr);
    });
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

  function openQa(step: QuickStep = "menu") {
    setSheet(null);
    setQaStep(step);
    setQaOpen(true);
  }

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2600);
  }

  const active = vehicles.find((v) => v.id === activeId) ?? null;
  const status = useMemo(
    () => (active ? vehicleStatusFor(active, items, ITEM_LABELS, statusRecords.lastMuayene, statusRecords.lastDetailing) : null),
    [active, items, statusRecords]
  );
  const initial = email ? email.split("@")[0][0]?.toLocaleUpperCase("tr-TR") : "?";

  if (loading) return <AuthShellLoading />;

  const today = todayIsoIstanbul();
  const ns = status?.nextService;
  const mu = active ? dateDueStatus(active.muayene_tarihi, today) : { level: "none", daysLeft: null };
  const muView = muayeneView({ nextIso: active?.muayene_tarihi || null, daysLeft: mu.daysLeft, level: mu.level, lastIso: statusRecords.lastMuayene?.service_date || null });
  const lastService = lastServiceRecord(timeline.rows);
  const docs = documents.docs;

  // Eksik kritik bilgi (önceki ana ekranla aynı kural).
  const missing: string[] = [];
  if (active) {
    if (!active.brand || !active.model) missing.push("marka/model");
    if (active.current_km == null || active.current_km === "") missing.push("kilometre");
    if (!active.next_service_km && !active.next_service_date) missing.push("bakım planı");
    if (!active.muayene_tarihi) missing.push("muayene tarihi");
    if (!active.kasko_bitis) missing.push("kasko bitişi");
    if (!active.trafik_sigortasi_bitis) missing.push("trafik sigortası bitişi");
  }

  const nsShort = !ns || ns.level === "none" ? "Plan yok" : ns.kmLeft != null && ns.kmLeft > 0 ? `${fmtKm(ns.kmLeft)} kaldı` : String(ns.detail || "").split(" · ")[0];

  const vehicleLine = active ? [[active.brand, active.model].filter(Boolean).join(" ") || "Marka/model girilmedi", active.year].filter(Boolean).join(" • ") : "";

  const switcher = active && switcherOpen && (
    <div id="arac-secici" data-testid="arac-secici" className="oz-card oz-enter" style={{ padding: 6 }}>
      <div role="listbox" aria-label="Araç seçin">
        {vehicles.map((v) => {
          const on = v.id === activeId;
          return (
            <button key={v.id} role="option" aria-selected={on} onClick={() => selectVehicle(v.id)} className="oz-row" style={{ padding: "8px 12px", borderRadius: 14, background: on ? "#171A1F" : "transparent", borderBottom: "none" }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 800, letterSpacing: 0.4 }}>{v.plate}</span>
                <span style={{ display: "block", fontSize: 12.5, color: "#A3ABB7" }}>{[v.brand, v.model].filter(Boolean).join(" ")}</span>
              </span>
              {on && <Icon name="check" color="#22C55E" size={18} />}
            </button>
          );
        })}
      </div>
      <a href="/bireysel/araclar/yeni" className="oz-row" style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "none" }}>
        <Icon name="plus-square" color="#A3ABB7" size={18} />
        <span style={{ fontWeight: 700 }}>Başka Araç Ekle</span>
      </a>
    </div>
  );

  const vehicleHero = (tall: boolean) =>
    active && (
      <CarHero
        tall={tall}
        testId="arac-kimligi"
        label="Araç kimliği"
        top={
          <>
            <span className="oz-eyebrow">{tall ? "Aracım" : "Dijital Kokpit"}</span>
            <button type="button" className="oz-glass-btn" data-testid="arac-degistir" aria-expanded={switcherOpen} aria-controls="arac-secici" onClick={() => setSwitcherOpen((v) => !v)}>
              <Icon name="swap" color="#E8EBEF" size={14} />
              Araç Değiştir
            </button>
          </>
        }
      >
        <h1 className="oz-plate" data-testid="aktif-plaka">
          {active.plate}
        </h1>
        <div className="oz-hero-sub">{vehicleLine}</div>
        {active.current_km != null && active.current_km !== "" && (
          <div className="oz-hero-km" data-testid="aktif-km">
            {Number(active.current_km).toLocaleString("tr-TR")} <small>km</small>
          </div>
        )}
      </CarHero>
    );

  return (
    <main className="oz-app oz-has-nav">
      <div className="oz-wrap">
        <header className="oz-topbar">
          <OtoizLogo variant="dark" size={104} />
          <DesktopNav active={section} onSelect={go} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="oz-iconbtn" aria-label="Bildirimler" onClick={() => router.push("/bireysel/bildirimler")}>
              <Icon name="bell" color="#F5F7FA" size={18} />
              {pendingTransfers.length > 0 && <span className="oz-dot" />}
            </button>
            <button type="button" className="oz-iconbtn" aria-label="Profil" onClick={() => router.push("/bireysel/profil")} style={{ color: "#86EFAC" }}>
              {initial}
            </button>
          </div>
        </header>

        {loadError && (
          <p role="alert" className="oz-card" style={{ borderColor: "#EF5350", fontSize: 14, margin: "0 0 16px" }}>
            Araçlarınız yüklenemedi. Bağlantınızı kontrol edip sayfayı yenileyin.
          </p>
        )}

        {!active ? (
          section === "diger" ? (
            <DigerSection onLogout={handleLogout} />
          ) : (
            <div className="oz-stack oz-enter" data-testid="birincil-aksiyon">
              <CarHero tall label="Araç ekleyin" top={<span className="oz-eyebrow">Dijital Kokpit</span>}>
                <h1 className="oz-h1" style={{ fontSize: 30 }}>Aracınızı ekleyin</h1>
                <div className="oz-hero-sub" style={{ fontWeight: 500 }}>Bakımlar, belgeler ve araç geçmişi tek yerde.</div>
              </CarHero>
              <a href="/bireysel/araclar/yeni" className="oz-btn">
                <Icon name="plus" color="#04110A" size={20} strokeWidth={2.6} />
                Aracımı Ekle
              </a>
              <a href="/aktivasyon" className="oz-btn is-ghost">
                <Icon name="qr" color="#86EFAC" size={18} />
                OTOİZ anahtarlığım var, etkinleştir
              </a>
              <InstallCta tone="light" />
            </div>
          )
        ) : (
          <>
            {section === "ana" && (
              <div className="oz-cockpit oz-enter" data-section="ana">
                <div className="oz-stack">
                  {pendingTransfers.length > 0 && (
                    <section className="oz-card" style={{ borderColor: "rgba(245,196,81,0.45)" }}>
                      <SectionHead title="Bekleyen Devirler" />
                      {pendingTransfers.map((t) => (
                        <div key={t.transfer_id} style={{ marginBottom: 10 }}>
                          <div style={{ fontWeight: 800, fontSize: 15 }}>{t.plate}</div>
                          <div style={{ fontSize: 13, color: "#A3ABB7", margin: "4px 0 12px" }}>
                            {t.brand} {t.model} · {t.expired ? "devir bağlantısının süresi doldu; aracı geri alabilirsiniz" : "yeni sahibin kabul etmesi bekleniyor"}
                          </div>
                          <button onClick={() => handleCancelTransfer(t.transfer_id)} disabled={cancelling === t.transfer_id} className="oz-btn is-ghost" style={{ minHeight: 50 }}>
                            {cancelling === t.transfer_id ? "İptal ediliyor…" : "Devri İptal Et, Aracı Geri Al"}
                          </button>
                        </div>
                      ))}
                    </section>
                  )}

                  {vehicleHero(false)}
                  {switcher}

                  {missing.length > 0 && (
                    <a href={`/bireysel/araclar/${active.id}#duzenle`} data-testid="eksik-bilgi" className="oz-row" style={{ minHeight: 48, padding: "6px 14px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "#111317" }}>
                      <span className="oz-lvl" data-level="soon" aria-hidden="true" />
                      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "#A3ABB7" }}>Eksik araç bilgileri var</span>
                      <span data-testid="eksik-bilgi-tamamla" style={{ fontSize: 13.5, fontWeight: 700, color: "#F5F7FA" }}>
                        Bilgileri tamamla →
                      </span>
                    </a>
                  )}

                  <div className="oz-stat3" data-testid="durum-uclu">
                    <StatCard label="Bakım" value={maintenanceWord(ns?.level)} level={ns?.level} testId="durum-bakim" onClick={() => setSheet("yaklasan")} />
                    <StatCard label="Muayene" value={muView.empty ? "Bilgi yok" : muView.text} level={muView.level} testId="durum-muayene" onClick={() => setSheet("muayene")} />
                    <StatCard label="Son servis" value={lastService ? fmtDate(lastService.event_date) : timeline.loading ? "…" : "Kayıt yok"} level={lastService ? "ok" : "none"} testId="durum-son-servis" onClick={() => go("bakim")} />
                  </div>

                  <div className="oz-tiles" data-testid="ana-kartlar">
                    <Tile icon="car" title="Aracım" sub="Bilgiler ve QR" onClick={() => go("aracim")} testId="kart-aracim" />
                    <Tile icon="history" title="Bakım Geçmişim" sub={timeline.total > 0 ? `${timeline.total} kayıt` : "Tüm kayıtlar"} onClick={() => go("bakim")} testId="kart-bakim" />
                    <Tile icon="document" title="Belgelerim" sub={docs === null ? "…" : docCountPhrase(docs.length)} onClick={() => go("belgeler")} testId="kart-belgeler" />
                    <Tile icon="gauge" title="Yaklaşan Bakımlar" sub={nsShort} level={ns?.level} onClick={() => setSheet("yaklasan")} testId="kart-yaklasan" />
                    <Tile icon="calendar" title="Muayene" sub={muView.empty ? "Bilgi eklenmemiş" : muView.text} level={muView.level} onClick={() => setSheet("muayene")} testId="kart-muayene" />
                    <Tile icon="handover" title="Aracı Devret" sub="Güvenli devir" href={`/bireysel/araclar/${active.id}/devret`} calm testId="kart-devret" />
                  </div>
                </div>

                <div className="oz-cockpit-side">
                  <section className="oz-card" aria-labelledby="gecmis-baslik" data-testid="aracinizin-gecmisi">
                    <SectionHead
                      id="gecmis-baslik"
                      title="Aracınızın Geçmişi"
                      action={
                        <button type="button" className="oz-pill-btn" data-testid="islem-ekle" onClick={() => openQa("menu")}>
                          <Icon name="plus" color="#86EFAC" size={16} strokeWidth={2.6} />
                          Ekle
                        </button>
                      }
                    />
                    {timeline.loading ? (
                      <Skeleton height={64} count={3} />
                    ) : timeline.error ? (
                      <p role="status" style={{ fontSize: 13.5, color: "#EF5350", margin: 0 }}>Geçmiş yüklenemedi. Sayfayı yenileyin.</p>
                    ) : timeline.rows.length === 0 ? (
                      <p data-testid="zaman-bos" style={{ fontSize: 14, color: "#A3ABB7", margin: 0, lineHeight: 1.5 }}>Henüz kayıt yok. İlk bakım kaydınız burada görünecek.</p>
                    ) : (
                      <TimelineList rows={timeline.rows.slice(0, 4)} />
                    )}
                    {timeline.total > 0 && (
                      <button type="button" className="oz-btn is-ghost" style={{ minHeight: 50, marginTop: 16 }} onClick={() => go("bakim")} data-testid="tumunu-gor">
                        Tümünü Gör
                        <Icon name="chevron-right" color="#A3ABB7" size={18} />
                      </button>
                    )}
                  </section>
                </div>
              </div>
            )}

            {section === "aracim" && (
              <div className="oz-split oz-enter" data-section="aracim">
                <div className="oz-stack">
                  {vehicleHero(true)}
                  {switcher}
                  <section className="oz-card" aria-label="Araç bilgileri" data-testid="arac-bilgileri">
                    <SectionHead
                      title="Araç Bilgileri"
                      action={
                        <a href={`/bireysel/araclar/${active.id}#duzenle`} className="oz-link">
                          Düzenle
                        </a>
                      }
                    />
                    <div className="oz-rows">
                      <InfoRow label="Plaka" value={active.plate} />
                      <InfoRow label="Marka" value={active.brand || "—"} />
                      <InfoRow label="Model" value={active.model || "—"} />
                      <InfoRow label="Yıl" value={active.year ? String(active.year) : "—"} />
                      <InfoRow label="Güncel km" value={active.current_km != null && active.current_km !== "" ? fmtKm(active.current_km) : "—"} />
                      <InfoRow label="Sonraki bakım" value={[active.next_service_km ? fmtKm(active.next_service_km) : null, active.next_service_date ? fmtDate(active.next_service_date) : null].filter(Boolean).join(" · ") || "Plan yok"} />
                      <InfoRow label="Muayene" value={active.muayene_tarihi ? fmtDate(active.muayene_tarihi) : "—"} />
                      <InfoRow label="Kasko bitişi" value={active.kasko_bitis ? fmtDate(active.kasko_bitis) : "—"} />
                      <InfoRow label="Trafik sigortası" value={active.trafik_sigortasi_bitis ? fmtDate(active.trafik_sigortasi_bitis) : "—"} />
                    </div>
                    <button type="button" className="oz-btn is-ghost" style={{ minHeight: 50, marginTop: 14 }} onClick={() => openQa("km")}>
                      <Icon name="gauge" color="#86EFAC" size={18} />
                      Kilometreyi Güncelle
                    </button>
                  </section>
                </div>
                <div className="oz-stack">
                  <OwnerKeychainCard vehicleId={active.id} />
                  <a href={`/bireysel/araclar/${active.id}`} className="oz-tile is-calm" data-testid="arac-tum-ayrintilar">
                    <span className="oz-tile-icon" aria-hidden="true">
                      <Icon name="clipboard" color="#A3ABB7" size={20} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="oz-tile-title">Tüm Ayrıntılar</span>
                      <span className="oz-tile-sub">Bakım planı, parça durumu, tarihler</span>
                    </span>
                    <Icon name="chevron-right" color="#6F7783" size={18} />
                  </a>
                  <Tile icon="handover" title="Aracı Devret" sub="Güvenli devir" href={`/bireysel/araclar/${active.id}/devret`} calm />
                </div>
              </div>
            )}

            {section === "belgeler" && (
              <section className="oz-enter" data-section="belgeler" aria-labelledby="belgeler-baslik">
                <SectionHead
                  id="belgeler-baslik"
                  title="Belgelerim"
                  action={
                    <button type="button" className="oz-pill-btn" onClick={() => openQa("belge")} data-testid="belge-ekle">
                      <Icon name="plus" color="#86EFAC" size={16} strokeWidth={2.6} />
                      Belge Ekle
                    </button>
                  }
                />
                <Chips label="Belge türü" options={DOC_FILTERS} value={docFilter} onChange={setDocFilter} />
                {docs === null ? (
                  <Skeleton height={84} count={3} />
                ) : (
                  (() => {
                    const list = filterDocuments(docs, docFilter);
                    if (list.length === 0) {
                      return (
                        <div className="oz-card" style={{ textAlign: "center", padding: "28px 18px" }}>
                          <Icon name="document" color="#6F7783" size={28} />
                          <p style={{ fontSize: 14, color: "#A3ABB7", margin: "10px 0 0", lineHeight: 1.5 }}>
                            {documents.error ? "Belgeler şu an yüklenemedi." : docs.length === 0 ? "Fatura, servis fişi veya sigorta belgelerinizi burada saklayabilirsiniz." : "Bu türde belge yok."}
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="oz-docs-grid" data-testid="belgelerim" style={{ display: "grid", gap: 10 }}>
                        {list.map((d: any) => (
                          <DocCard key={d.id} doc={d} url={documents.urls[d.id]} onDelete={() => { documents.setDeleteError(""); documents.setDeleteTarget(d); }} />
                        ))}
                      </div>
                    );
                  })()
                )}
                <DocumentDeleteDialog
                  target={documents.deleteTarget}
                  deleting={documents.deleting}
                  error={documents.deleteError}
                  onCancel={() => !documents.deleting && documents.setDeleteTarget(null)}
                  onConfirm={documents.confirmDelete}
                />
              </section>
            )}

            {section === "bakim" && (
              <div className="oz-split oz-enter" data-section="bakim">
                <section aria-labelledby="bakim-baslik">
                  <SectionHead
                    id="bakim-baslik"
                    title="Bakım Geçmişi"
                    action={
                      <button type="button" className="oz-pill-btn" onClick={() => openQa("bakim")} data-testid="bakim-ekle">
                        <Icon name="plus" color="#86EFAC" size={16} strokeWidth={2.6} />
                        Kayıt Ekle
                      </button>
                    }
                  />
                  <Chips label="Kayıt kaynağı" options={TL_FILTERS} value={tlFilter} onChange={setTlFilter} />
                  <div className="oz-card" data-testid="zaman-cizelgesi">
                    {timeline.loading ? (
                      <Skeleton height={64} count={4} />
                    ) : (
                      (() => {
                        const list = filterTimeline(timeline.rows, tlFilter);
                        return list.length === 0 ? (
                          <p data-testid="zaman-bos" style={{ fontSize: 14, color: "#A3ABB7", margin: 0, lineHeight: 1.5 }}>
                            {tlFilter === "tumu" ? "Henüz kayıt yok." : tlFilter === "servis" ? "Servis doğrulamalı kayıt yok." : "Kendi eklediğiniz kayıt yok."}
                          </p>
                        ) : (
                          <TimelineList rows={list} />
                        );
                      })()
                    )}
                    {timeline.hasMore && (
                      <button type="button" className="oz-btn is-ghost" style={{ minHeight: 50, marginTop: 16 }} onClick={timeline.loadMore} disabled={timeline.loadingMore} data-testid="zaman-daha-fazla">
                        {timeline.loadingMore ? "Yükleniyor…" : `Daha fazla göster (${timeline.rows.length} / ${timeline.total})`}
                      </button>
                    )}
                  </div>
                </section>
                <div className="oz-stack">
                  <button type="button" className="oz-tile is-calm" onClick={() => setSheet("yaklasan")} style={{ background: "#111317" }}>
                    <span className="oz-tile-icon" aria-hidden="true">
                      <Icon name="gauge" color="#86EFAC" size={20} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="oz-tile-title">Yaklaşan Bakım</span>
                      <span className="oz-tile-sub" data-level={ns?.level}>{nsShort}</span>
                    </span>
                    <Icon name="chevron-right" color="#6F7783" size={18} />
                  </button>
                </div>
              </div>
            )}

            {section === "diger" && <DigerSection onLogout={handleLogout} vehicleId={active.id} />}
          </>
        )}
      </div>

      {active && (
        <>
          <BottomSheet open={sheet === "yaklasan"} title="Yaklaşan Bakımlar" onClose={() => setSheet(null)} testId="yaklasan-pencere">
            <UpcomingView ns={ns} vehicle={active} items={items} upcoming={status?.upcoming ?? []} today={today} onAdd={() => openQa("bakim")} />
          </BottomSheet>
          <BottomSheet open={sheet === "muayene"} title="Muayene" onClose={() => setSheet(null)} testId="muayene-pencere">
            <MuayeneView view={muView} onEdit={() => openQa("tarih")} />
          </BottomSheet>
          <QuickActionSheet
            open={qaOpen}
            initialStep={qaStep}
            onClose={() => setQaOpen(false)}
            supabase={supabase}
            vehicle={active}
            userId={userId}
            maintenanceItems={items}
            onVehiclePatch={(patch) => setVehicles((list) => list.map((v) => (v.id === active.id ? { ...v, ...patch } : v)))}
            onMaintenanceSaved={async () => {
              const { items: it, sr } = await loadActiveData(active.id);
              setItems(it);
              setStatusRecords(sr);
              setTlReload((n) => n + 1);
              const { data: v } = await supabase.from("vehicles").select("*").eq("id", active.id).single();
              if (v) setVehicles((list) => list.map((x) => (x.id === v.id ? v : x)));
            }}
            onDocumentSaved={() => setDocsReload((n) => n + 1)}
            onSuccess={showToast}
          />
        </>
      )}
      <SuccessToast message={toast} />

      <BottomNav active={section} onSelect={go} desktopFloating={false} />
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="oz-row" style={{ minHeight: 50 }}>
      <span className="oz-row-label">{label}</span>
      <span className="oz-row-value">{value}</span>
    </div>
  );
}

function DocCard({ doc, url, onDelete }: { doc: any; url?: string; onDelete: () => void }) {
  const ext = String(doc.file_name || "").split(".").pop()?.toUpperCase().slice(0, 4) || "DOSYA";
  const when = doc.doc_date ? fmtDate(doc.doc_date) : new Date(doc.created_at).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
  return (
    <div className="oz-doc" data-testid="belge-satir" data-type={doc.doc_type}>
      <span className="oz-doc-icon" aria-hidden="true">
        <Icon name="document" color="#86EFAC" size={20} />
        {ext}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="oz-doc-title">{DOC_TYPE_LABELS[doc.doc_type] || "Belge"}</div>
        <div className="oz-doc-meta">{[when, fmtSize(doc.size_bytes), doc.note].filter(Boolean).join(" · ")}</div>
        <div className="oz-doc-actions">
          <a
            href={url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!url}
            className="oz-pill-btn"
            style={{ opacity: url ? 1 : 0.45, pointerEvents: url ? undefined : "none" }}
            aria-label={`${DOC_TYPE_LABELS[doc.doc_type] || "Belge"} görüntüle`}
          >
            Görüntüle
          </a>
          {doc.own && (
            <button type="button" data-testid="belge-sil" onClick={onDelete} className="oz-pill-btn" style={{ color: "#FF8A80", borderColor: "rgba(239,83,80,0.35)", background: "transparent" }} aria-label={`${DOC_TYPE_LABELS[doc.doc_type] || "Belge"} sil`}>
              Sil
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function UpcomingView({ ns, vehicle, items, upcoming, today, onAdd }: { ns: any; vehicle: any; items: any[]; upcoming: any[]; today: string; onAdd: () => void }) {
  const level = ns?.level ?? "none";
  const hasPlan = level !== "none";
  const kmLeft = ns?.kmLeft;
  const daysLeft = ns?.daysLeft;
  let value = "Plan yok";
  let caption = "Bakım planı eklenmemiş.";
  let fraction = 0;
  if (hasPlan) {
    if (kmLeft != null) {
      value = kmLeft > 0 ? fmtKm(kmLeft) : "Gecikti";
      caption = kmLeft > 0 ? "sonra bakım" : `${fmtKm(Math.abs(kmLeft))} aşıldı`;
      fraction = ringFraction(kmLeft, 10000);
    } else if (daysLeft != null) {
      value = daysLeft >= 0 ? remainingPhrase(daysLeft) : "Gecikti";
      caption = daysLeft >= 0 ? "sonra bakım" : remainingPhrase(daysLeft);
      fraction = ringFraction(daysLeft, 365);
    }
  }
  const approx = hasPlan && daysLeft != null && daysLeft > 0 ? approxPhrase(daysLeft) : "";

  // Önerilen / yaklaşan kalemler: önce gerçekten yaklaşan/geciken, sonra
  // periyodu tanımlı diğer kalemler (kalan süreye göre).
  const itemRows = (Array.isArray(items) ? items : [])
    .map((it: any) => ({ it, st: itemStatus(it, vehicle.current_km, today) }))
    .filter((x: any) => x.st.level !== "none")
    .sort((a: any, b: any) => (a.st.kmLeft ?? 1e9) - (b.st.kmLeft ?? 1e9));
  const seen = new Set(upcoming.map((u: any) => u.key));
  const others = itemRows.filter((x: any) => !seen.has(`item_${x.it.item_key}`));

  return (
    <div data-testid="yaklasan-islemler">
      <RingGauge fraction={fraction} level={level} testId="bakim-gosterge">
        <span className="oz-ring-value" style={{ fontSize: value.length > 9 ? 26 : 34 }}>{value}</span>
        <span className="oz-ring-caption">{caption}</span>
      </RingGauge>
      {approx && <p style={{ textAlign: "center", fontSize: 15, fontWeight: 700, margin: "14px 0 0" }}>{approx}</p>}
      {hasPlan && ns?.target && <p style={{ textAlign: "center", fontSize: 13, color: "#A3ABB7", margin: "4px 0 0" }}>Hedef: {ns.target}</p>}

      <h3 style={{ fontSize: 15, fontWeight: 800, margin: "24px 0 10px" }}>Yaklaşan ve önerilen kalemler</h3>
      {upcoming.length === 0 && others.length === 0 ? (
        <p style={{ fontSize: 14, color: "#A3ABB7", margin: 0, lineHeight: 1.5 }}>
          {hasPlan ? "Önümüzdeki 30 gün / 1.000 km içinde işlem görünmüyor." : "Bakım planı ve parça periyotları girildiğinde burada listelenir."}
        </p>
      ) : (
        <div className="oz-rows">
          {upcoming.map((u: any) => (
            <div key={u.key} className="oz-row">
              <span className="oz-lvl" data-level={u.level} aria-hidden="true" />
              <span style={{ flex: 1, minWidth: 0, fontWeight: 700 }}>{u.title}</span>
              <span style={{ fontSize: 13.5, color: "#A3ABB7", whiteSpace: "nowrap" }}>{u.detail}</span>
            </div>
          ))}
          {others.slice(0, 6).map(({ it, st }: any) => (
            <div key={it.item_key} className="oz-row">
              <span className="oz-lvl" data-level={st.level} aria-hidden="true" />
              <span style={{ flex: 1, minWidth: 0, fontWeight: 700 }}>{ITEM_LABELS[it.item_key] || it.item_key}</span>
              <span style={{ fontSize: 13.5, color: "#A3ABB7", whiteSpace: "nowrap" }}>
                {st.kmLeft != null ? `${fmtKm(st.kmLeft)} kaldı` : remainingPhrase(st.daysLeft)}
              </span>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="oz-btn" style={{ marginTop: 20 }} onClick={onAdd}>
        <Icon name="plus" color="#04110A" size={20} strokeWidth={2.6} />
        Bakım Kaydı Ekle
      </button>
      <p style={{ fontSize: 12, color: "#6F7783", margin: "12px 0 0", lineHeight: 1.45 }}>Durumlar yalnız kayıtlı tarih, kilometre ve bakım planına göre hesaplanır; mekanik değerlendirme değildir.</p>
    </div>
  );
}

function MuayeneView({ view, onEdit }: { view: any; onEdit: () => void }) {
  return (
    <div data-testid="muayene-ozet">
      <RingGauge fraction={view.fraction} level={view.level} testId="muayene-gosterge">
        {view.empty ? (
          <span className="oz-ring-caption" style={{ fontSize: 15, color: "#F5F7FA", fontWeight: 700 }}>
            {view.text}
          </span>
        ) : (
          <>
            <span className="oz-ring-value">{view.text}</span>
            <span className="oz-ring-caption">sonraki muayeneye</span>
          </>
        )}
      </RingGauge>
      <div className="oz-rows" style={{ marginTop: 18 }}>
        <div className="oz-row">
          <span className="oz-row-label">Son muayene</span>
          <span className="oz-row-value">{view.last || "Kayıt yok"}</span>
        </div>
        <div className="oz-row">
          <span className="oz-row-label">Sonraki muayene</span>
          <span className="oz-row-value">{view.next || "Girilmedi"}</span>
        </div>
      </div>
      <button type="button" className="oz-btn" style={{ marginTop: 20 }} onClick={onEdit}>
        <Icon name="calendar" color="#04110A" size={18} />
        {view.empty ? "Muayene Tarihi Ekle" : "Tarihi Güncelle"}
      </button>
    </div>
  );
}

function DigerSection({ onLogout, vehicleId }: { onLogout: () => void; vehicleId?: string }) {
  const rows = [
    { href: "/bireysel/bildirimler", icon: "bell", label: "Bildirimler" },
    { href: "/bireysel/profil", icon: "user", label: "Profil ve Hesap" },
    { href: "/bireysel/araclar/yeni", icon: "plus-square", label: "Araç Ekle" },
    { href: "/aktivasyon", icon: "qr", label: "Anahtarlık Etkinleştir" },
    ...(vehicleId ? [{ href: `/bireysel/araclar/${vehicleId}`, icon: "clipboard", label: "Araç Ayrıntıları" }] : []),
    { href: "/bireysel/gorus", icon: "message", label: "Görüş Bildir" },
  ];
  return (
    <section className="oz-stack oz-enter" data-section="diger" aria-labelledby="diger-baslik" style={{ maxWidth: 640 }}>
      <h1 id="diger-baslik" className="oz-h1">
        Diğer
      </h1>
      <div className="oz-card" style={{ padding: "4px 16px" }}>
        <div className="oz-rows">
          {rows.map((r) => (
            <a key={r.href} href={r.href} className="oz-row">
              <span className="oz-tile-icon" aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 11 }}>
                <Icon name={r.icon} color="#86EFAC" size={18} />
              </span>
              <span style={{ flex: 1, fontWeight: 700 }}>{r.label}</span>
              <Icon name="chevron-right" color="#6F7783" size={18} />
            </a>
          ))}
        </div>
      </div>
      <InstallCta tone="light" />
      <button type="button" onClick={onLogout} className="oz-btn is-ghost" style={{ color: "#FF8A80" }}>
        Çıkış Yap
      </button>
    </section>
  );
}
