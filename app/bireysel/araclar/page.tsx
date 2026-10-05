"use client";

// OTOİZ Premium — bireysel ana deneyim = DİJİTAL KOKPİT (2026-10-05, onaylı
// referans görsel). Tek merkez: alt gezinmedeki 5 bölüm (Ana Sayfa, Aracım,
// Belgeler, Bakım, Diğer) ile Yaklaşan Bakımlar ve Muayene ekranları aynı
// sayfada değişir (?bolum=); alt ekranlar geri okuyla ana ekrana döner.
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
import { IconSquare, SubHeader, StatCard, Tile, SectionHead, Segmented, Gauge, BottomSheet, useTimeline, TimelineList, Skeleton } from "@/components/Premium";
import { PILOT_FLAGS } from "@/lib/pilotFlags";

const { ITEM_LABELS } = require("@/lib/maintenanceItems");
const { fmtDate, dateDueStatus, itemStatus, criticalSummary } = require("@/lib/vehicleStatus");
const { todayIsoIstanbul } = require("@/lib/logic");
const { DOC_TYPE_LABELS, fmtSize } = require("@/lib/quickActions");
const {
  sectionFrom,
  navFor,
  longDate,
  remainingParts,
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
  const [section, setSection] = useState<string>("ana");
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
  const [qrOpen, setQrOpen] = useState(false);
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

  function go(next: string) {
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
  const hasKm = active && active.current_km != null && active.current_km !== "";
  const muayeneDoc = Array.isArray(docs) ? docs.find((d: any) => d.doc_type === "muayene") : null;
  const back = () => go("ana");
  // Hatırlatma satırı: yaklaşan/geciken tarih ve bakım varsa (yoksa hiç görünmez).
  const reminders = status ? criticalSummary(status) : { count: 0 };

  const switcher = active && switcherOpen && (
    <div id="arac-secici" data-testid="arac-secici" className="oz-card oz-enter" style={{ padding: 6 }}>
      <div role="listbox" aria-label="Araç seçin">
        {vehicles.map((v) => {
          const on = v.id === activeId;
          return (
            <button key={v.id} role="option" aria-selected={on} onClick={() => selectVehicle(v.id)} className="oz-row" style={{ padding: "8px 12px", borderRadius: 12, background: on ? "#182023" : "transparent", borderBottom: "none" }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 700, letterSpacing: 0.3 }}>{v.plate}</span>
                <span style={{ display: "block", fontSize: 12.5, color: "#A3ABB7" }}>{[v.brand, v.model].filter(Boolean).join(" ")}</span>
              </span>
              {on && <Icon name="check" color="#22C55E" size={18} />}
            </button>
          );
        })}
      </div>
      <a href="/bireysel/araclar/yeni" className="oz-row" style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.07)", borderBottom: "none" }}>
        <Icon name="plus-square" color="#A3ABB7" size={18} />
        <span style={{ fontWeight: 600 }}>Başka Araç Ekle</span>
      </a>
    </div>
  );

  const topbar = (
    <header className={`oz-topbar${section === "ana" || !active ? "" : " is-sub"}`}>
      <a href="/bireysel/araclar" aria-label="OTOİZ ana ekran" onClick={(e) => { e.preventDefault(); go("ana"); }} style={{ display: "inline-flex" }}>
        <OtoizLogo variant="dark" size={104} />
      </a>
      <DesktopNav active={navFor(section) as NavKey} onSelect={go} />
      <button type="button" className="oz-iconbtn" aria-label="Bildirimler" onClick={() => router.push("/bireysel/bildirimler")}>
        <Icon name="bell" color="#F5F7FA" size={21} />
        {pendingTransfers.length > 0 && <span className="oz-dot" />}
      </button>
    </header>
  );

  return (
    <main className="oz-app oz-has-nav">
      <div className={`oz-wrap${section === "ana" || section === "aracim" || !active ? "" : " is-narrow"}`}>
        {topbar}

        {loadError && (
          <p role="alert" className="oz-card" style={{ borderColor: "#EF4444", fontSize: 14, margin: "0 0 16px" }}>
            Araçlarınız yüklenemedi. Bağlantınızı kontrol edip sayfayı yenileyin.
          </p>
        )}

        {!active ? (
          section === "diger" ? (
            <DigerSection onLogout={handleLogout} onBack={back} />
          ) : (
            <div className="oz-stack oz-enter" data-testid="birincil-aksiyon">
              <section className="oz-vcard" aria-label="Araç ekleyin">
                <h1 className="oz-plate" style={{ fontSize: 24, whiteSpace: "normal" }}>Aracınızı ekleyin</h1>
                <div className="oz-vsub">Bakımlar, belgeler ve araç geçmişi tek yerde.</div>
                <div className="oz-carimg" aria-hidden="true" />
              </section>
              <a href="/bireysel/araclar/yeni" className="oz-btn">
                <Icon name="plus" color="#04110A" size={20} strokeWidth={2.6} />
                Aracımı Ekle
              </a>
              <a href="/aktivasyon" className="oz-btn is-ghost">
                <Icon name="qr" color="#4ADE80" size={18} />
                OTOİZ anahtarlığım var, etkinleştir
              </a>
              <InstallCta tone="light" />
            </div>
          )
        ) : (
          <>
            {section === "ana" && (
              <div className="oz-cockpit oz-enter" data-section="ana">
                <div className="oz-ck-main oz-stack">
                  {pendingTransfers.length > 0 && (
                    <section className="oz-card" style={{ borderColor: "rgba(245,165,36,0.45)" }}>
                      <SectionHead title="Bekleyen Devirler" />
                      {pendingTransfers.map((t) => (
                        <div key={t.transfer_id} style={{ marginBottom: 10 }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{t.plate}</div>
                          <div style={{ fontSize: 13, color: "#A3ABB7", margin: "4px 0 12px" }}>
                            {t.brand} {t.model} · {t.expired ? "devir bağlantısının süresi doldu; aracı geri alabilirsiniz" : "yeni sahibin kabul etmesi bekleniyor"}
                          </div>
                          <button onClick={() => handleCancelTransfer(t.transfer_id)} disabled={cancelling === t.transfer_id} className="oz-btn is-ghost" style={{ minHeight: 48 }}>
                            {cancelling === t.transfer_id ? "İptal ediliyor…" : "Devri İptal Et, Aracı Geri Al"}
                          </button>
                        </div>
                      ))}
                    </section>
                  )}

                  <section className="oz-vcard" data-testid="arac-kimligi" aria-label="Araç kimliği">
                    <div className="oz-vcard-head">
                      <div style={{ minWidth: 0 }}>
                        <h1 className="oz-plate" data-testid="aktif-plaka">
                          {active.plate}
                        </h1>
                        <div className="oz-vsub">{vehicleLine}</div>
                      </div>
                      {vehicles.length > 1 && (
                        <button type="button" className="oz-switch" data-testid="arac-degistir" aria-expanded={switcherOpen} aria-controls="arac-secici" onClick={() => setSwitcherOpen((v) => !v)}>
                          Araç Değiştir
                          <Icon name="chevron-down" color="#C3C9D1" size={14} />
                        </button>
                      )}
                    </div>
                    <div className="oz-carimg" aria-hidden="true" />
                    <div className="oz-vcard-foot">
                      {hasKm ? (
                        <span className="oz-vkm" data-testid="aktif-km">
                          {fmtKm(active.current_km)}
                        </span>
                      ) : (
                        <span className="oz-vkm" style={{ fontSize: 15, color: "#A3ABB7" }}>
                          Kilometre girilmedi
                        </span>
                      )}
                      <button type="button" className="oz-smallbtn" data-testid="km-duzenle" onClick={() => openQa("km")} aria-label="Kilometreyi düzenle">
                        Düzenle
                      </button>
                    </div>
                    {missing.length > 0 && (
                      <div data-testid="eksik-bilgi" className="oz-missing">
                        <span className="oz-lvl" data-level="soon" aria-hidden="true" />
                        <span style={{ flex: 1, minWidth: 0 }}>Eksik araç bilgileri var</span>
                        <a href={`/bireysel/araclar/${active.id}#duzenle`} data-testid="eksik-bilgi-tamamla">
                          Bilgileri tamamla →
                        </a>
                      </div>
                    )}
                  </section>
                  {switcher}

                  {reminders.count > 0 && (
                    <button
                      type="button"
                      data-testid="kritik-ozet"
                      data-level={reminders.level}
                      onClick={() => go("yaklasan")}
                      className="oz-row"
                      style={{ minHeight: 52, padding: "8px 14px", borderRadius: 14, border: `1px solid ${reminders.level === "late" ? "rgba(239,68,68,0.4)" : "rgba(245,165,36,0.4)"}`, background: "#12171A" }}
                    >
                      <IconSquare icon="alert" tone={reminders.level === "late" ? "red-t" : "amber-t"} size="sm" />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{reminders.title}</span>
                        <span style={{ display: "block", fontSize: 12.5, color: "#A3ABB7", marginTop: 2 }}>{reminders.line}</span>
                      </span>
                      <Icon name="chevron-right" color="#6F7783" size={18} />
                    </button>
                  )}

                  <div className="oz-stat3" data-testid="durum-uclu">
                    <StatCard label="Bakım" value={maintenanceWord(ns?.level)} level={ns?.level} icon="shield-check" tone="green" testId="durum-bakim" onClick={() => go("yaklasan")} />
                    <StatCard label="Muayene" value={muView.empty ? "Bilgi yok" : muView.text} level={muView.level} icon="shield" tone="amber" testId="durum-muayene" onClick={() => go("muayene")} />
                    <StatCard
                      label="Son servis"
                      value={lastService ? fmtDate(lastService.event_date) : timeline.loading ? "…" : "Kayıt yok"}
                      level="none"
                      icon="wrench"
                      tone="gray"
                      testId="durum-son-servis"
                      onClick={() => go("bakim")}
                    />
                  </div>
                </div>

                <section className="oz-ck-hist" aria-labelledby="gecmis-baslik" data-testid="aracinizin-gecmisi">
                  <SectionHead
                    id="gecmis-baslik"
                    title="Aracınızın Geçmişi"
                    action={
                      timeline.total > 0 ? (
                        <button type="button" className="oz-link" onClick={() => go("bakim")} data-testid="tumunu-gor">
                          Tümünü Gör
                          <Icon name="chevron-right" color="#4ADE80" size={15} />
                        </button>
                      ) : undefined
                    }
                  />
                  {timeline.loading ? (
                    <Skeleton height={56} count={3} />
                  ) : timeline.error ? (
                    <p role="status" style={{ fontSize: 13.5, color: "#F87171", margin: 0 }}>Geçmiş yüklenemedi. Sayfayı yenileyin.</p>
                  ) : timeline.rows.length === 0 ? (
                    <div className="oz-card" style={{ textAlign: "center" }}>
                      <p data-testid="zaman-bos" style={{ fontSize: 13.5, color: "#A3ABB7", margin: "0 0 12px", lineHeight: 1.5 }}>Henüz kayıt yok. İlk bakım kaydınız burada görünecek.</p>
                      <button type="button" className="oz-smallbtn" onClick={() => openQa("bakim")}>
                        <Icon name="plus" color="#4ADE80" size={15} strokeWidth={2.6} />
                        Kayıt Ekle
                      </button>
                    </div>
                  ) : (
                    <TimelineList rows={timeline.rows.slice(0, 3)} compact />
                  )}
                </section>

                <div className="oz-ck-tiles oz-tiles" data-testid="ana-kartlar">
                  <Tile icon="car" tone="green" title="Aracım" sub="Bilgiler ve QR" onClick={() => go("aracim")} testId="kart-aracim" />
                  <Tile icon="wrench" tone="green-t" title="Bakım Geçmişim" sub="Tüm kayıtlar" onClick={() => go("bakim")} testId="kart-bakim" />
                  <Tile icon="document" tone="blue" title="Belgelerim" sub={docs === null ? "…" : docCountPhrase(docs.length)} onClick={() => go("belgeler")} testId="kart-belgeler" />
                  <Tile icon="calendar" tone="amber" title="Yaklaşan Bakımlar" sub={nsShort} level={ns?.level} onClick={() => go("yaklasan")} testId="kart-yaklasan" />
                  <Tile icon="shield-check" tone="green-t" title="Muayene" sub={muView.empty ? "Bilgi eklenmemiş" : muView.text} level={muView.level} onClick={() => go("muayene")} testId="kart-muayene" />
                  <Tile icon="transfer" tone="red-t" title="Aracı Devret" sub="Güvenli devir" href={`/bireysel/araclar/${active.id}/devret`} testId="kart-devret" />
                </div>

                <div className="oz-ck-value oz-stack">
                  <section className="oz-valuecard" aria-label="OTOİZ">
                    <div>
                      <p className="oz-valuecard-title">Aracınızın değeri geçmişinde gizlidir.</p>
                      <span className="oz-valuecard-bar" aria-hidden="true" />
                    </div>
                  </section>
                  <InstallCta tone="light" />
                </div>
              </div>
            )}

            {section === "aracim" && (
              <div className="oz-enter" data-section="aracim">
                <SubHeader title="Aracım" onBack={back} />
                <div className="oz-split">
                  <div>
                    <div className="oz-carstage" aria-hidden="true" />
                    <div className="oz-vcard-head" style={{ alignItems: "center", margin: "6px 0 16px" }}>
                      <div style={{ minWidth: 0 }}>
                        <h2 className="oz-plate" style={{ fontSize: 24 }}>
                          {active.plate}
                        </h2>
                        <div className="oz-vsub">{vehicleLine}</div>
                      </div>
                      <a href={`/bireysel/araclar/${active.id}#duzenle`} className="oz-smallbtn">
                        Düzenle
                      </a>
                    </div>
                  </div>
                  <div className="oz-stack">
                    <div className="oz-table" data-testid="arac-bilgileri" aria-label="Araç bilgileri" role="group">
                      <TableRow label="Marka" value={active.brand || "—"} />
                      <TableRow label="Model" value={active.model || "—"} />
                      <TableRow label="Yıl" value={active.year ? String(active.year) : "—"} />
                      <TableRow label="Plaka" value={active.plate} />
                      <TableRow label="Güncel KM" value={hasKm ? fmtKm(active.current_km) : "—"} />
                      <div className="oz-table-row">
                        <span>QR Kodu</span>
                        <button type="button" onClick={() => setQrOpen(true)} data-testid="qr-goruntule">
                          Görüntüle
                        </button>
                      </div>
                    </div>
                    <button type="button" className="oz-btn is-ghost" style={{ minHeight: 48 }} onClick={() => openQa("km")}>
                      <Icon name="gauge" color="#4ADE80" size={18} />
                      Kilometreyi Güncelle
                    </button>
                    <a href={`/bireysel/araclar/${active.id}`} className="oz-row" data-testid="arac-tum-ayrintilar" style={{ borderBottom: "none", padding: "6px 2px" }}>
                      <IconSquare icon="clipboard" tone="gray" size="sm" />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 600 }}>Tüm Ayrıntılar</span>
                        <span style={{ display: "block", fontSize: 12.5, color: "#A3ABB7" }}>Bakım planı, sigorta ve kasko tarihleri</span>
                      </span>
                      <Icon name="chevron-right" color="#6F7783" size={18} />
                    </a>
                  </div>
                </div>
                <BottomSheet open={qrOpen} title="QR Kodu" onClose={() => setQrOpen(false)} testId="qr-pencere">
                  <OwnerKeychainCard vehicleId={active.id} />
                </BottomSheet>
              </div>
            )}

            {section === "belgeler" && (
              <section className="oz-enter" data-section="belgeler" aria-labelledby="belgeler-baslik">
                <SubHeader title="Belgelerim" id="belgeler-baslik" onBack={back} />
                <Segmented label="Belge türü" options={DOC_FILTERS} value={docFilter} onChange={setDocFilter} />
                {docs === null ? (
                  <Skeleton height={76} count={3} />
                ) : (
                  (() => {
                    const list = filterDocuments(docs, docFilter);
                    if (list.length === 0) {
                      return (
                        <div className="oz-card" style={{ textAlign: "center", padding: "26px 18px" }}>
                          <Icon name="document" color="#6F7783" size={28} />
                          <p style={{ fontSize: 13.5, color: "#A3ABB7", margin: "10px 0 0", lineHeight: 1.5 }}>
                            {documents.error ? "Belgeler şu an yüklenemedi." : docs.length === 0 ? "Fatura, servis fişi veya sigorta belgelerinizi burada saklayabilirsiniz." : "Bu türde belge yok."}
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div data-testid="belgelerim" style={{ display: "grid", gap: 10 }}>
                        {list.map((d: any) => (
                          <DocCard
                            key={d.id}
                            doc={d}
                            url={documents.urls[d.id]}
                            onDelete={() => {
                              documents.setDeleteError("");
                              documents.setDeleteTarget(d);
                            }}
                          />
                        ))}
                      </div>
                    );
                  })()
                )}
                <button type="button" className="oz-btn" style={{ marginTop: 16 }} onClick={() => openQa("belge")} data-testid="belge-ekle">
                  <Icon name="plus" color="#04110A" size={18} strokeWidth={2.6} />
                  Belge Yükle
                </button>
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
              <section className="oz-enter" data-section="bakim" aria-labelledby="bakim-baslik">
                <SubHeader
                  title="Bakım Geçmişi"
                  id="bakim-baslik"
                  onBack={back}
                  action={
                    <button type="button" className="oz-iconbtn" onClick={() => openQa("bakim")} data-testid="bakim-ekle" aria-label="Kayıt Ekle">
                      <Icon name="plus" color="#4ADE80" size={22} strokeWidth={2.4} />
                    </button>
                  }
                />
                <Segmented label="Kayıt kaynağı" options={TL_FILTERS} value={tlFilter} onChange={setTlFilter} />
                <div data-testid="zaman-cizelgesi" style={{ paddingTop: 4 }}>
                  {timeline.loading ? (
                    <Skeleton height={64} count={4} />
                  ) : (
                    (() => {
                      const list = filterTimeline(timeline.rows, tlFilter);
                      return list.length === 0 ? (
                        <p data-testid="zaman-bos" style={{ fontSize: 13.5, color: "#A3ABB7", margin: 0, lineHeight: 1.5 }}>
                          {tlFilter === "tumu" ? "Henüz kayıt yok." : tlFilter === "servis" ? "Servis doğrulamalı kayıt yok." : "Kendi eklediğiniz kayıt yok."}
                        </p>
                      ) : (
                        <TimelineList rows={list} />
                      );
                    })()
                  )}
                  {timeline.hasMore && (
                    <button type="button" className="oz-btn is-ghost" style={{ minHeight: 48, marginTop: 16 }} onClick={timeline.loadMore} disabled={timeline.loadingMore} data-testid="zaman-daha-fazla">
                      {timeline.loadingMore ? "Yükleniyor…" : `Daha fazla göster (${timeline.rows.length} / ${timeline.total})`}
                    </button>
                  )}
                </div>
              </section>
            )}

            {section === "yaklasan" && (
              <section className="oz-enter" data-section="yaklasan" aria-labelledby="yaklasan-baslik">
                <SubHeader title="Yaklaşan Bakımlar" id="yaklasan-baslik" onBack={back} />
                <UpcomingView ns={ns} vehicle={active} items={items} upcoming={status?.upcoming ?? []} today={today} onAdd={() => openQa("bakim")} />
              </section>
            )}

            {section === "muayene" && (
              <section className="oz-enter" data-section="muayene" aria-labelledby="muayene-baslik">
                <SubHeader title="Muayene" id="muayene-baslik" onBack={back} />
                <MuayeneView view={muView} reportUrl={muayeneDoc ? documents.urls[muayeneDoc.id] : undefined} hasReport={!!muayeneDoc} onEdit={() => openQa("tarih")} />
              </section>
            )}

            {section === "diger" && <DigerSection onLogout={handleLogout} onBack={back} vehicleId={active.id} />}
          </>
        )}
      </div>

      {active && (
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
      )}
      <SuccessToast message={toast} />

      <BottomNav active={navFor(section) as NavKey} onSelect={go} desktopFloating={false} />
    </main>
  );
}

function TableRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="oz-table-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function DocCard({ doc, url, onDelete }: { doc: any; url?: string; onDelete: () => void }) {
  const ext = String(doc.file_name || "").split(".").pop()?.toLowerCase().slice(0, 4) || "dosya";
  const isImg = String(doc.mime_type || "").startsWith("image/");
  const label = DOC_TYPE_LABELS[doc.doc_type] || "Belge";
  const when = doc.doc_date ? fmtDate(doc.doc_date) : new Date(doc.created_at).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
  return (
    <div className="oz-doc" data-testid="belge-satir" data-type={doc.doc_type}>
      <span className="oz-file" aria-hidden="true">
        <span className="oz-file-tag" data-kind={isImg ? "img" : "pdf"}>
          {ext}
        </span>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="oz-doc-title">{label}</div>
        <div className="oz-doc-meta">{[when, fmtSize(doc.size_bytes)].filter(Boolean).join(" • ")}</div>
        {doc.note && <div className="oz-doc-meta">{doc.note}</div>}
      </div>
      <div className="oz-doc-actions">
        {doc.own && (
          <button type="button" data-testid="belge-sil" onClick={onDelete} className="oz-iconbtn" aria-label={`${label} sil`}>
            <Icon name="trash" color="#8B939E" size={18} />
          </button>
        )}
        <a
          href={url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!url}
          className="oz-iconbtn"
          style={{ opacity: url ? 1 : 0.4, pointerEvents: url ? undefined : "none" }}
          aria-label={`${label} görüntüle`}
        >
          <Icon name="download" color="#D5DAE1" size={19} />
        </a>
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
      fraction = 1 - ringFraction(kmLeft, 10000);
    } else if (daysLeft != null) {
      const p = remainingParts(daysLeft);
      value = daysLeft >= 0 ? p.value : "Gecikti";
      caption = daysLeft >= 0 ? "sonra bakım" : remainingPhrase(daysLeft);
      fraction = 1 - ringFraction(daysLeft, 365);
    }
    if (level === "late") fraction = 1;
    fraction = Math.max(0.04, fraction);
  }
  const approx = hasPlan && daysLeft != null && daysLeft > 0 ? approxPhrase(daysLeft) : "";

  // Önerilen kalemler: önce gerçekten yaklaşan/geciken, sonra periyodu
  // tanımlı diğer kalemler (kalan kilometreye göre).
  const itemRows = (Array.isArray(items) ? items : [])
    .map((it: any) => ({ it, st: itemStatus(it, vehicle.current_km, today) }))
    .filter((x: any) => x.st.level !== "none")
    .sort((a: any, b: any) => (a.st.kmLeft ?? 1e9) - (b.st.kmLeft ?? 1e9));
  const seen = new Set(upcoming.map((u: any) => u.key));
  const others = itemRows.filter((x: any) => !seen.has(`item_${x.it.item_key}`));

  return (
    <div data-testid="yaklasan-pencere">
      <div data-testid="yaklasan-islemler">
        <Gauge fraction={fraction} level={level} variant="warm" testId="bakim-gosterge">
          <Icon name="engine" color={level === "late" ? "#F87171" : "#F5A524"} size={30} />
          <span className="oz-gauge-value" style={{ fontSize: value.length > 9 ? 24 : 30 }}>
            {value}
          </span>
          <span className="oz-gauge-caption">{caption}</span>
        </Gauge>
        {approx && <p className="oz-approx">{approx}</p>}

        <div className="oz-list" style={{ marginTop: 22 }}>
          <h2 className="oz-list-title">Önerilen Bakımlar</h2>
          {upcoming.length === 0 && others.length === 0 ? (
            <p style={{ fontSize: 13.5, color: "#A3ABB7", margin: "4px 0 10px", lineHeight: 1.5 }}>
              {hasPlan ? "Önümüzdeki 30 gün / 1.000 km içinde işlem görünmüyor." : "Bakım planı ve parça periyotları girildiğinde burada listelenir."}
            </p>
          ) : (
            <div>
              {upcoming.map((u: any) => (
                <div key={u.key} className="oz-list-row">
                  <span className="oz-bullet" data-level={u.level} aria-hidden="true" />
                  <span className="oz-list-name">{u.title}</span>
                  <span className="oz-list-val" data-level={u.level}>
                    {u.detail}
                  </span>
                </div>
              ))}
              {others.slice(0, 6).map(({ it, st }: any) => (
                <div key={it.item_key} className="oz-list-row">
                  <span className="oz-bullet" data-level={st.level} aria-hidden="true" />
                  <span className="oz-list-name">{ITEM_LABELS[it.item_key] || it.item_key}</span>
                  <span className="oz-list-val" data-level={st.level}>
                    {st.kmLeft != null ? `${fmtKm(st.kmLeft)} kaldı` : remainingPhrase(st.daysLeft)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {!hasPlan && (
        <a href={`/bireysel/araclar/${vehicle.id}#duzenle`} className="oz-btn" style={{ marginTop: 16 }}>
          Bakım Planı Ekle
        </a>
      )}
      <button type="button" className="oz-btn is-ghost" style={{ marginTop: 12, minHeight: 48 }} onClick={onAdd}>
        <Icon name="plus" color="#4ADE80" size={18} strokeWidth={2.6} />
        Bakım Kaydı Ekle
      </button>
      <p className="oz-note">
        <Icon name="info" color="#F5A524" size={18} />
        <span>Durumlar yalnız kayıtlı tarih, kilometre ve bakım planına göre hesaplanır; mekanik değerlendirme değildir.</span>
      </p>
    </div>
  );
}

function MuayeneView({ view, reportUrl, hasReport, onEdit }: { view: any; reportUrl?: string; hasReport: boolean; onEdit: () => void }) {
  return (
    <div data-testid="muayene-pencere">
      <div data-testid="muayene-ozet">
        <Gauge fraction={view.empty ? 0 : view.level === "late" ? 1 : Math.max(0.04, 1 - view.fraction)} level={view.level} variant="green" testId="muayene-gosterge">
          <Icon name="shield-check" color={view.level === "late" ? "#F87171" : view.level === "soon" ? "#FBBF24" : "#4ADE80"} size={30} />
          {view.empty ? (
            <span className="oz-gauge-caption" style={{ fontSize: 14.5, color: "#F5F7FA", fontWeight: 600, marginTop: 10 }}>
              {view.text}
            </span>
          ) : (
            <>
              <span className="oz-gauge-value" style={{ fontSize: 34 }}>
                {view.value}
              </span>
              {view.caption && <span className="oz-gauge-caption">{view.caption}</span>}
            </>
          )}
        </Gauge>

        <div className="oz-kv" style={{ marginTop: 18 }}>
          <div>
            <span className="oz-kv-label">Son Muayene</span>
            <span className="oz-kv-value">{view.last || "Kayıt yok"}</span>
          </div>
          <div>
            <span className="oz-kv-label">Sonraki Muayene</span>
            <span className="oz-kv-value">{view.next || "Girilmedi"}</span>
          </div>
        </div>
      </div>

      {hasReport ? (
        <>
          <a
            href={reportUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="oz-btn"
            data-testid="muayene-rapor"
            aria-disabled={!reportUrl}
            style={{ marginTop: 16, opacity: reportUrl ? 1 : 0.5, pointerEvents: reportUrl ? undefined : "none" }}
          >
            Muayene Raporunu Görüntüle
          </a>
          <button type="button" className="oz-btn is-ghost" style={{ marginTop: 10, minHeight: 46 }} onClick={onEdit}>
            Tarihi Güncelle
          </button>
        </>
      ) : (
        <button type="button" className="oz-btn" style={{ marginTop: 16 }} onClick={onEdit}>
          {view.empty ? "Muayene Tarihi Ekle" : "Muayene Tarihini Güncelle"}
        </button>
      )}
      <p className="oz-note">
        <Icon name="info" color="#F5A524" size={18} />
        <span>Muayene tarihinizi takip ederek aracınızın her zaman yasal ve güvenli olmasını sağlayın.</span>
      </p>
    </div>
  );
}

function DigerSection({ onLogout, onBack, vehicleId }: { onLogout: () => void; onBack: () => void; vehicleId?: string }) {
  const rows = [
    { href: "/bireysel/bildirimler", icon: "bell", label: "Bildirimler", tone: "green-t" },
    { href: "/bireysel/profil", icon: "user", label: "Profil ve Hesap", tone: "blue" },
    { href: "/bireysel/araclar/yeni", icon: "plus-square", label: "Araç Ekle", tone: "green-t" },
    { href: "/aktivasyon", icon: "qr", label: "Anahtarlık Etkinleştir", tone: "green-t" },
    ...(vehicleId ? [{ href: `/bireysel/araclar/${vehicleId}`, icon: "clipboard", label: "Araç Ayrıntıları", tone: "gray" }] : []),
    { href: "/bireysel/gorus", icon: "message", label: "Görüş Bildir", tone: "amber-t" },
  ];
  return (
    <section className="oz-enter" data-section="diger" aria-labelledby="diger-baslik">
      <SubHeader title="Diğer" id="diger-baslik" onBack={onBack} />
      <div className="oz-stack">
        <div className="oz-card" style={{ padding: "2px 14px" }}>
          <div className="oz-rows">
            {rows.map((r) => (
              <a key={r.href} href={r.href} className="oz-row">
                <IconSquare icon={r.icon} tone={r.tone} size="sm" />
                <span style={{ flex: 1, fontWeight: 600 }}>{r.label}</span>
                <Icon name="chevron-right" color="#6F7783" size={18} />
              </a>
            ))}
          </div>
        </div>
        <InstallCta tone="light" />
        <button type="button" onClick={onLogout} className="oz-btn is-ghost" style={{ color: "#F87171" }}>
          Çıkış Yap
        </button>
      </div>
    </section>
  );
}
