"use client";

// OTOİZ Yönetim Paneli — yalnız platform yöneticisi (proje sahibi).
// Tüm veriler /api/admin/* üzerinden gelir; bu uç noktalar her istekte
// çağıranın public.platform_admins listesinde olduğunu sunucu tarafında
// doğrular. Bu sayfa yalnızca arayüzdür — yetki kararı burada verilmez.

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, radius, inputStyle, labelStyle, primaryButtonStyle, cardStyle, badgeStyle } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";

type Tab = "genel" | "kullanicilar" | "qr" | "araclar" | "servisler";

const TABS: { key: Tab; label: string }[] = [
  { key: "genel", label: "Genel Bakış" },
  { key: "kullanicilar", label: "Kullanıcılar" },
  { key: "qr", label: "QR Kodları" },
  { key: "araclar", label: "Araçlar" },
  { key: "servisler", label: "Servisler" },
];

const QR_COUNTS = [10, 20, 30, 100];

function fmtDate(d: string | null | undefined, withTime = false) {
  if (!d) return "—";
  const dt = new Date(d);
  return withTime
    ? dt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : dt.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
}

function ago(d: string | null | undefined) {
  if (!d) return "hiç girmedi";
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "son 1 saat";
  if (h < 24) return `${h} saat önce`;
  const days = Math.floor(h / 24);
  return `${days} gün önce`;
}

const STATUS_LABEL: Record<string, { text: string; kind: "success" | "warning" | "danger" | "neutral" }> = {
  free: { text: "Boşta", kind: "neutral" },
  reserved: { text: "Servise ayrıldı", kind: "warning" },
  assigned: { text: "Araca bağlı", kind: "success" },
  revoked: { text: "İptal", kind: "danger" },
};

const TYPE_LABEL: Record<string, string> = { yonetici: "Yönetici", servis: "Servis", bireysel: "Bireysel" };

export default function YonetimPage() {
  const supabase = createBrowserSupabase();
  const [stage, setStage] = useState<"loading" | "login" | "forbidden" | "ready">("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("genel");

  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [qrData, setQrData] = useState<{ batches: string[]; codes: any[] }>({ batches: [], codes: [] });
  const [qrFilter, setQrFilter] = useState("all");
  const [qrBatch, setQrBatch] = useState("");
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleQuery, setVehicleQuery] = useState("");

  const [genCount, setGenCount] = useState<number | "">("");
  const [genTenant, setGenTenant] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [assignCode, setAssignCode] = useState<string | null>(null);
  const [assignQuery, setAssignQuery] = useState("");
  const [assignResults, setAssignResults] = useState<any[]>([]);
  const [reserveTenant, setReserveTenant] = useState("");
  const [reserveCount, setReserveCount] = useState<number | "">("");

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function api(path: string, init?: RequestInit) {
    const t = await token();
    const res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t ?? ""}`, ...(init?.headers || {}) },
      cache: "no-store",
    });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  }

  async function checkAdmin() {
    const t = await token();
    if (!t) {
      setStage("login");
      return;
    }
    const r = await api("/api/admin/me");
    if (r.ok) {
      setAdminEmail(r.body?.email ?? null);
      setStage("ready");
    } else if (r.status === 401) {
      setStage("login");
    } else {
      setStage("forbidden");
    }
  }

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (stage !== "ready") return;
    if (tab === "genel" || tab === "servisler") loadOverview();
    if (tab === "kullanicilar") loadUsers();
    if (tab === "qr") {
      loadQr();
      if (!overview) loadOverview();
    }
    if (tab === "araclar") loadVehicles("");
  }, [stage, tab]);

  useEffect(() => {
    if (stage === "ready" && tab === "qr") loadQr();
  }, [qrFilter, qrBatch]);

  async function loadOverview() {
    const r = await api("/api/admin/overview");
    if (r.ok) setOverview(r.body);
    else setError(r.body?.error || "Genel bakış yüklenemedi");
  }
  async function loadUsers() {
    const r = await api("/api/admin/kullanicilar");
    if (r.ok) setUsers(r.body.users ?? []);
    else setError(r.body?.error || "Kullanıcılar yüklenemedi");
  }
  async function loadQr() {
    const params = new URLSearchParams();
    params.set("filter", qrFilter);
    if (qrBatch) params.set("batch", qrBatch);
    const r = await api(`/api/admin/qr?${params.toString()}`);
    if (r.ok) setQrData({ batches: r.body.batches ?? [], codes: r.body.codes ?? [] });
    else setError(r.body?.error || "QR listesi yüklenemedi");
  }
  async function loadVehicles(q: string) {
    const r = await api(`/api/admin/araclar?q=${encodeURIComponent(q)}`);
    if (r.ok) setVehicles(r.body.vehicles ?? []);
    else setError(r.body?.error || "Araçlar yüklenemedi");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoggingIn(false);
    if (err) {
      setLoginError("E-posta veya şifre hatalı.");
      return;
    }
    await checkAdmin();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setStage("login");
    setOverview(null);
  }

  function flash(msg: string) {
    setError("");
    setNotice(msg);
    setTimeout(() => setNotice(""), 6000);
  }

  async function generate() {
    if (typeof genCount !== "number" || genCount < 1) return;
    setBusy(true);
    setError("");
    const r = await api("/api/admin/qr", {
      method: "POST",
      body: JSON.stringify({ action: "generate", count: genCount, reserved_tenant_id: genTenant || null }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.body?.error || "QR üretilemedi");
      return;
    }
    flash(`${r.body.codes.length} adet benzersiz QR üretildi — "${r.body.batch_label}"`);
    setGenCount("");
    setQrBatch(r.body.batch_label);
    setQrFilter("all");
    loadQr();
    loadOverview();
  }

  async function qrAction(payload: any, okMsg: string) {
    setBusy(true);
    setError("");
    const r = await api("/api/admin/qr", { method: "POST", body: JSON.stringify(payload) });
    setBusy(false);
    if (!r.ok) {
      setError(r.body?.error || "İşlem başarısız");
      return false;
    }
    flash(okMsg);
    loadQr();
    loadOverview();
    return true;
  }

  async function searchForAssign(q: string) {
    setAssignQuery(q);
    const r = await api(`/api/admin/araclar?q=${encodeURIComponent(q)}`);
    if (r.ok) setAssignResults(r.body.vehicles ?? []);
  }

  // ---------- Giriş / yetki ekranları ----------
  if (stage === "loading") {
    return <main style={{ padding: 40, textAlign: "center", fontFamily: font, color: colors.textMuted }}>Yükleniyor…</main>;
  }

  if (stage === "login" || stage === "forbidden") {
    return (
      <main style={{ minHeight: "100vh", background: colors.bg, fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <OtoizLogo variant="dark" size={180} mark="primary" />
          </div>
          <div style={{ ...cardStyle, padding: 22 }}>
            <h1 style={{ fontSize: 19, margin: "0 0 4px", color: colors.textDark }}>Yönetim Paneli</h1>
            <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 18px" }}>Yalnızca OTOİZ platform yöneticisi içindir.</p>
            {stage === "forbidden" ? (
              <>
                <p role="alert" style={{ fontSize: 14, color: colors.danger, marginBottom: 16 }}>
                  Bu hesabın yönetim paneline erişim yetkisi yok.
                </p>
                <button onClick={handleLogout} style={primaryButtonStyle(false)}>Farklı hesapla giriş yap</button>
              </>
            ) : (
              <form onSubmit={handleLogin}>
                <label style={labelStyle} htmlFor="adm-email">E-posta</label>
                <input id="adm-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
                <label style={labelStyle} htmlFor="adm-pass">Şifre</label>
                <input id="adm-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
                {loginError && <p role="alert" style={{ color: colors.danger, fontSize: 13, margin: "0 0 12px" }}>{loginError}</p>}
                <button type="submit" disabled={loggingIn} style={primaryButtonStyle(loggingIn)}>
                  {loggingIn ? "Giriş yapılıyor…" : "Giriş Yap"}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ---------- Yönetici arayüzü ----------
  const c = overview?.counts;
  const tenants: any[] = overview?.tenants ?? [];

  const statCard = (label: string, value: any, sub?: string) => (
    <div style={{ ...cardStyle, padding: 14, flex: "1 1 150px", minWidth: 140 }}>
      <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: colors.textDark, marginTop: 2 }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const smallBtn = (bg: string, fg: string, border?: string): React.CSSProperties => ({
    padding: "8px 12px", minHeight: 40, borderRadius: radius.sm, border: border ? `1.5px solid ${border}` : "none",
    background: bg, color: fg, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: font,
  });

  return (
    <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, color: colors.textDark }}>
      <header style={{ background: colors.bg, padding: "12px 16px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <OtoizLogo variant="dark" size={110} />
            <span style={{ color: colors.green, fontWeight: 800, fontSize: 13, letterSpacing: 0.6 }}>YÖNETİM</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 12.5 }}>{adminEmail}</span>
            <button onClick={handleLogout} style={{ ...smallBtn("transparent", "rgba(255,255,255,0.8)", "rgba(255,255,255,0.25)"), minHeight: 44 }}>Çıkış</button>
          </div>
        </div>
      </header>

      <nav aria-label="Yönetim sekmeleri" style={{ background: colors.surfaceLight, borderBottom: `1px solid ${colors.border}`, overflowX: "auto" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 4, padding: "0 8px" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              style={{
                padding: "14px 14px", minHeight: 48, border: "none", background: "none", cursor: "pointer", fontFamily: font,
                fontSize: 14, fontWeight: tab === t.key ? 800 : 600, whiteSpace: "nowrap",
                color: tab === t.key ? colors.textDark : colors.textMuted,
                borderBottom: `3px solid ${tab === t.key ? colors.green : "transparent"}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 16px 60px" }}>
        {notice && <div role="status" style={{ background: colors.greenSoft, color: colors.greenDark, padding: "10px 14px", borderRadius: radius.sm, fontWeight: 700, fontSize: 13.5, marginBottom: 14 }}>{notice}</div>}
        {error && <div role="alert" style={{ background: colors.dangerSoft, color: colors.danger, padding: "10px 14px", borderRadius: radius.sm, fontWeight: 700, fontSize: 13.5, marginBottom: 14 }}>{error}</div>}

        {/* ================= GENEL BAKIŞ ================= */}
        {tab === "genel" && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
              {statCard("Kayıtlı kullanıcı", c?.users, c ? `Son 7 gün aktif: ${c.active_users_7d ?? "—"} · 30 gün: ${c.active_users_30d ?? "—"}` : undefined)}
              {statCard("Servis", c?.tenants, c ? `${c.staff} servis çalışanı` : undefined)}
              {statCard("Araç", c?.vehicles, c ? `${c.vehicles_service} servis · ${c.vehicles_individual} bireysel` : undefined)}
              {statCard("Bakım kaydı", c?.records, c ? `${c.records_service} servis · ${c.records_owner} araç sahibi` : undefined)}
              {statCard("QR kodu", c?.qr_total, c ? `${c.qr_assigned} bağlı · ${c.qr_reserved_free} serviste · ${c.qr_free} boşta` : undefined)}
            </div>

            <section style={{ ...cardStyle, marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Son eklenen kayıtlar — kim, ne ekledi</h2>
              {(overview?.recent_records ?? []).length === 0 && <p style={{ color: colors.textMuted, fontSize: 13.5 }}>Henüz kayıt yok.</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(overview?.recent_records ?? []).map((r: any) => (
                  <div key={r.id} style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", alignItems: "baseline", borderBottom: `1px solid ${colors.border}`, paddingBottom: 8 }}>
                    <strong style={{ fontSize: 14, minWidth: 96 }}>{r.plate}</strong>
                    <span style={{ fontSize: 13.5, flex: "1 1 200px" }}>{r.description}{r.km_at_service ? ` · ${Number(r.km_at_service).toLocaleString("tr-TR")} km` : ""}</span>
                    <span style={badgeStyle(r.source === "Araç sahibi" ? "neutral" : "success")}>{r.source}</span>
                    <span style={{ fontSize: 12, color: colors.textMuted }}>{r.created_by_email ?? "—"} · {fmtDate(r.created_at, true)}</span>
                  </div>
                ))}
              </div>
            </section>

            <button onClick={() => setTab("kullanicilar")} style={{ ...smallBtn(colors.surfaceLight, colors.textDark, colors.border), minHeight: 44 }}>
              Kullanıcıların tüm kullanım detayı →
            </button>
          </>
        )}

        {/* ================= KULLANICILAR ================= */}
        {tab === "kullanicilar" && (
          <section style={cardStyle}>
            <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Kullanıcılar ve kullanım</h2>
            <p style={{ fontSize: 12.5, color: colors.textMuted, margin: "0 0 12px" }}>
              Toplam {users.length} kullanıcı · son 7 günde giriş yapan {users.filter((u) => u.last_sign_in_at && Date.now() - new Date(u.last_sign_in_at).getTime() < 7 * 86400000).length}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {users.map((u) => (
                <div key={u.id} style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 12, display: "flex", flexWrap: "wrap", gap: "6px 16px", alignItems: "center" }}>
                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, wordBreak: "break-all" }}>{u.email}</div>
                    <div style={{ fontSize: 12, color: colors.textMuted }}>
                      {TYPE_LABEL[u.type]}{u.tenant_name ? ` · ${u.tenant_name}${u.staff_role === "owner" ? " (işletme sahibi)" : ""}` : ""} · kayıt {fmtDate(u.created_at)}
                    </div>
                  </div>
                  <span style={badgeStyle(u.last_sign_in_at && Date.now() - new Date(u.last_sign_in_at).getTime() < 7 * 86400000 ? "success" : "neutral")}>
                    Son giriş: {ago(u.last_sign_in_at)}
                  </span>
                  <span style={{ fontSize: 13 }}>🚗 {u.vehicles} araç</span>
                  <span style={{ fontSize: 13 }}>🛠 {u.records_created} kayıt{u.last_record_at ? ` (son: ${fmtDate(u.last_record_at)})` : ""}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ================= QR KODLARI ================= */}
        {tab === "qr" && (
          <>
            <section style={{ ...cardStyle, marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Yeni QR üret</h2>
              <p style={{ fontSize: 12.5, color: colors.textMuted, margin: "0 0 12px" }}>
                Her kod benzersiz ve tahmin edilemez (12 karakter, kriptografik rastgele). Yalnız bu panelden üretilebilir.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {QR_COUNTS.map((n) => (
                  <button key={n} onClick={() => setGenCount(n)} style={smallBtn(genCount === n ? colors.green : colors.surfaceLight, colors.textDark, genCount === n ? undefined : colors.border)}>
                    {n} adet
                  </button>
                ))}
                <input
                  type="number" inputMode="numeric" min={1} max={500} placeholder="Diğer adet"
                  value={genCount === "" || QR_COUNTS.includes(genCount as number) ? "" : genCount}
                  onChange={(e) => setGenCount(e.target.value ? Math.max(1, Math.min(500, Number(e.target.value))) : "")}
                  style={{ ...inputStyle, width: 140 }}
                />
              </div>
              <label style={labelStyle} htmlFor="gen-tenant">Üretilen kodları doğrudan bir servise ayır (isteğe bağlı)</label>
              <select id="gen-tenant" value={genTenant} onChange={(e) => setGenTenant(e.target.value)} style={{ ...inputStyle, marginBottom: 12, maxWidth: 420 }}>
                <option value="">— Servise ayırma, boşta kalsın —</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div>
                <button
                  onClick={generate}
                  disabled={busy || typeof genCount !== "number"}
                  style={{ ...primaryButtonStyle(busy), width: "auto", padding: "12px 22px", opacity: typeof genCount !== "number" ? 0.5 : 1 }}
                >
                  {busy ? "Üretiliyor…" : typeof genCount === "number" ? `${genCount} adet QR üret` : "Adet seçin"}
                </button>
              </div>
            </section>

            <section style={{ ...cardStyle, marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Boştaki kodları servise ayır</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <select value={reserveTenant} onChange={(e) => setReserveTenant(e.target.value)} style={{ ...inputStyle, maxWidth: 280 }} aria-label="Servis">
                  <option value="">— Servis seçin —</option>
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input type="number" inputMode="numeric" min={1} max={500} placeholder="Adet" aria-label="Adet" value={reserveCount}
                  onChange={(e) => setReserveCount(e.target.value ? Number(e.target.value) : "")} style={{ ...inputStyle, width: 110 }} />
                <button
                  disabled={busy || !reserveTenant || typeof reserveCount !== "number"}
                  onClick={async () => {
                    const ok = await qrAction({ action: "reserve", tenant_id: reserveTenant, count: reserveCount }, `${reserveCount} kod servise ayrıldı`);
                    if (ok) setReserveCount("");
                  }}
                  style={smallBtn(colors.textDark, colors.textLight)}
                >
                  Ayır
                </button>
              </div>
              <p style={{ fontSize: 12, color: colors.textMuted, margin: "8px 0 0" }}>
                Servis, yalnız kendisine ayrılan kodları "Anahtarlık Eşleştir" ekranından kendi araçlarına bağlayabilir.
              </p>
            </section>

            <section style={cardStyle}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ fontSize: 16, margin: 0, marginRight: "auto" }}>Kodlar ({qrData.codes.length})</h2>
                <select value={qrFilter} onChange={(e) => setQrFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }} aria-label="Durum">
                  <option value="all">Tümü</option>
                  <option value="free">Boşta</option>
                  <option value="reserved">Servise ayrılmış</option>
                  <option value="assigned">Araca bağlı</option>
                  <option value="revoked">İptal</option>
                </select>
                <select value={qrBatch} onChange={(e) => setQrBatch(e.target.value)} style={{ ...inputStyle, width: "auto", maxWidth: 280 }} aria-label="Parti">
                  <option value="">Tüm partiler</option>
                  {qrData.batches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                {qrBatch && (
                  <a href={`/yonetim/yazdir?batch=${encodeURIComponent(qrBatch)}`} target="_blank" rel="noopener" style={{ ...smallBtn(colors.green, colors.textDark), textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                    Partiyi yazdır
                  </a>
                )}
              </div>

              {qrData.codes.length === 0 && <p style={{ color: colors.textMuted, fontSize: 13.5 }}>Kod yok.</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {qrData.codes.map((q) => (
                  <div key={q.id} style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 10 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", alignItems: "center" }}>
                      <code style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}>{q.code}</code>
                      <span style={badgeStyle(STATUS_LABEL[q.status].kind)}>{STATUS_LABEL[q.status].text}</span>
                      {q.reserved_tenant && q.status !== "assigned" && <span style={{ fontSize: 12.5 }}>→ {q.reserved_tenant.name}</span>}
                      {q.vehicle && (
                        <span style={{ fontSize: 12.5 }}>
                          → <strong>{q.vehicle.plate}</strong> ({q.vehicle.owner_type === "servis" ? q.vehicle.tenant_name : "bireysel"})
                        </span>
                      )}
                      <span style={{ fontSize: 11.5, color: colors.textMuted, marginLeft: "auto" }}>{q.batch_label}</span>
                    </div>
                    {q.status !== "revoked" && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {!q.vehicle && (
                          <button onClick={() => { setAssignCode(q.code); setAssignResults([]); setAssignQuery(""); }} style={smallBtn(colors.surfaceSoft, colors.textDark, colors.border)}>
                            Araca ata
                          </button>
                        )}
                        {q.status === "reserved" && (
                          <button onClick={() => qrAction({ action: "unreserve", code: q.code }, "Servis ayırması kaldırıldı")} style={smallBtn(colors.surfaceSoft, colors.textDark, colors.border)}>
                            Ayırmayı kaldır
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm(`${q.code} kodu iptal edilsin mi? Bu işlem geri alınamaz.`)) {
                              qrAction({ action: "revoke", code: q.code }, "Kod iptal edildi");
                            }
                          }}
                          style={smallBtn(colors.surfaceLight, colors.danger, colors.danger)}
                        >
                          İptal et
                        </button>
                      </div>
                    )}

                    {assignCode === q.code && (
                      <div style={{ marginTop: 10, background: colors.surfaceSoft, borderRadius: radius.sm, padding: 10 }}>
                        <label style={labelStyle} htmlFor={`assign-${q.id}`}>Plaka ile araç ara (bireysel veya servis)</label>
                        <input id={`assign-${q.id}`} autoFocus value={assignQuery} onChange={(e) => searchForAssign(e.target.value)} placeholder="örn. 06 ABC 123" style={{ ...inputStyle, marginBottom: 8 }} />
                        {assignResults.slice(0, 8).map((v) => (
                          <div key={v.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${colors.border}` }}>
                            <strong>{v.plate}</strong>
                            <span style={{ fontSize: 12.5 }}>{v.brand} {v.model}</span>
                            <span style={badgeStyle(v.owner_type === "servis" ? "success" : "neutral")}>{v.owner_type === "servis" ? v.tenant_name : `Bireysel${v.owner_email ? " · " + v.owner_email : ""}`}</span>
                            {v.active_qr ? (
                              <span style={{ fontSize: 12, color: colors.textMuted }}>Zaten QR'ı var ({v.active_qr})</span>
                            ) : (
                              <button
                                onClick={async () => {
                                  if (!window.confirm(`${q.code} kodu ${v.plate} aracına bağlansın mı?`)) return;
                                  const ok = await qrAction({ action: "assign", code: q.code, vehicle_id: v.id }, `${q.code} → ${v.plate} bağlandı`);
                                  if (ok) setAssignCode(null);
                                }}
                                style={{ ...smallBtn(colors.green, colors.textDark), marginLeft: "auto" }}
                              >
                                Bu araca bağla
                              </button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => setAssignCode(null)} style={{ ...smallBtn("transparent", colors.textMuted), marginTop: 6 }}>Vazgeç</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ================= ARAÇLAR ================= */}
        {tab === "araclar" && (
          <section style={cardStyle}>
            <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Tüm araçlar</h2>
            <input
              value={vehicleQuery}
              onChange={(e) => { setVehicleQuery(e.target.value); loadVehicles(e.target.value); }}
              placeholder="Plaka ile ara…"
              aria-label="Plaka ile ara"
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {vehicles.map((v) => (
                <div key={v.id} style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 10, display: "flex", flexWrap: "wrap", gap: "4px 12px", alignItems: "center" }}>
                  <strong style={{ minWidth: 100 }}>{v.plate}</strong>
                  <span style={{ fontSize: 13 }}>{v.brand} {v.model}{v.year ? ` · ${v.year}` : ""}</span>
                  <span style={badgeStyle(v.owner_type === "servis" ? "success" : "neutral")}>{v.owner_type === "servis" ? v.tenant_name : `Bireysel${v.owner_email ? " · " + v.owner_email : ""}`}</span>
                  <span style={{ fontSize: 12.5, color: colors.textMuted }}>
                    {v.current_km != null ? `${Number(v.current_km).toLocaleString("tr-TR")} km` : "km yok"}
                    {v.next_service_km ? ` · sonraki ${Number(v.next_service_km).toLocaleString("tr-TR")} km` : ""}
                  </span>
                  <span style={{ fontSize: 12.5, marginLeft: "auto" }}>{v.active_qr ? `QR: ${v.active_qr}` : "QR yok"}</span>
                </div>
              ))}
              {vehicles.length === 0 && <p style={{ color: colors.textMuted, fontSize: 13.5 }}>Araç bulunamadı.</p>}
            </div>
          </section>
        )}

        {/* ================= SERVİSLER ================= */}
        {tab === "servisler" && (
          <section style={cardStyle}>
            <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Servisler</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tenants.map((t) => (
                <div key={t.id} style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 12, display: "flex", flexWrap: "wrap", gap: "4px 16px", alignItems: "center" }}>
                  <div style={{ flex: "1 1 220px" }}>
                    <div style={{ fontWeight: 700 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: colors.textMuted }}>{t.phone || "telefon yok"} · kayıt {fmtDate(t.created_at)}</div>
                  </div>
                  <span style={badgeStyle(t.is_active === false ? "danger" : "success")}>{t.is_active === false ? "Pasif" : "Aktif"}</span>
                  <span style={{ fontSize: 13 }}>{t.staff} çalışan</span>
                  <span style={{ fontSize: 13 }}>{t.vehicles} araç</span>
                  <span style={{ fontSize: 13 }}>{t.records} kayıt</span>
                  <span style={{ fontSize: 13 }}>{t.qr_reserved_free} boş QR</span>
                </div>
              ))}
              {tenants.length === 0 && <p style={{ color: colors.textMuted, fontSize: 13.5 }}>Servis yok.</p>}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
