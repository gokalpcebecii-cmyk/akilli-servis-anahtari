"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { PILOT_FLAGS } from "@/lib/pilotFlags";
import { SubHeader } from "@/components/Premium";

const {
  TRANSFER_DOCS_TITLE,
  TRANSFER_DOCS_HINT,
  TRANSFER_DOCS_EMPTY,
  initialDocumentSelection,
  toggleDocumentSelection,
  selectedDocumentIds,
  transferErrorMessage,
} = require("@/lib/documentTransfer");
const { DOC_TYPE_LABELS } = require("@/lib/quickActions");

// Referans devir dili: 3 adım (mevcut E–H devir akışı aynen çalışır).
const STEPS = ["Yeni sahibi davet edin", "Devredilecek belgeleri seçin", "Güvenli devri tamamlayın"];

export default function BireyselDevretPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createBrowserSupabase();

  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ token: string; expires_at: string; document_count?: number } | null>(null);
  const [copied, setCopied] = useState(false);
  // Aktarılabilir belgeler (gerçek kayıtlar, /api/belgeler → RLS). Seçim
  // varsayılan olarak BOŞ; yalnız işaretlenenler sunucuya gönderilir.
  const [docs, setDocs] = useState<any[] | null>(null);
  const [docsError, setDocsError] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialDocumentSelection());

  useEffect(() => {
    // İkinci düzeltme turu (madde 3): kapalıyken araç sorgusu dahi
    // çalışmasın (hook koşulsuz çağrılır, yalnızca gövdesi erken çıkar).
    if (!PILOT_FLAGS.ownershipTransferSelfService) {
      setLoading(false);
      return;
    }
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/bireysel/giris");
        return;
      }
      const { data: v } = await supabase.from("vehicles").select("id, plate, brand, model, owner_user_id").eq("id", params.id).single();
      if (!v || v.owner_user_id !== session.session.user.id) {
        router.push("/bireysel/araclar");
        return;
      }
      setVehicle(v);
      setLoading(false);
      try {
        const res = await fetch(`/api/belgeler?vehicle_id=${encodeURIComponent(String(params.id))}`, {
          headers: { Authorization: `Bearer ${session.session.access_token}` },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        setDocs(body.documents ?? []);
      } catch {
        setDocsError(true);
        setDocs([]);
      }
    }
    load();
  }, [params.id]);

  async function handleStart() {
    setStarting(true);
    setError("");
    // ÜÇÜNCÜ düzeltme turu (madde 6): ikinci turda RPC çağrısı geçici
    // olarak /api/ownership-transfer-initiate'e taşınmıştı. İncelemede,
    // initiate_ownership_transfer RPC'sinin SECURITY DEFINER olduğu ve
    // EXECUTE yetkisinin doğrudan `authenticated` rolüne verildiği
    // doğrulandı — yani bu RPC, doğrudan supabase.rpc(...) ile HER ZAMAN
    // çağrılabilir durumdaydı; Next.js tarafındaki PILOT_FLAGS kontrolü
    // bu gerçek çağrı yolunu HİÇ ENGELLEMİYORDU, yalnızca kendi API
    // route'umuzu (gereksiz bir ek saldırı yüzeyini) kapatıyordu. Bu
    // yanıltıcı "kapatıldı" izlenimini vermemek için route silindi, RPC
    // tekrar doğrudan çağrılıyor. Gerçek koruma yalnızca aşağıdaki UI
    // seviyesi PILOT_FLAGS kontrolüdür (normal uygulama akışını kapatır,
    // doğrudan RPC çağrısını DURDURMAZ) — RPC'nin EXECUTE yetkisinin
    // authenticated'dan kaldırılması SECURITY_FIX_04_PROPOSAL.md'de
    // ÖNERİ olarak yazıldı, uygulanmadı.
    // Seçilen belge kimlikleri sunucuya gider; veritabanı her kimliği
    // (bu araca ait mi, çağıranın erişimi var mı) ayrıca doğrular, tek bir
    // geçersiz kimlikte devri hiç oluşturmaz.
    const { data, error: rpcError } = await supabase.rpc("initiate_ownership_transfer", {
      p_vehicle_id: params.id,
      p_document_ids: selectedDocumentIds(selected, docs),
    });
    setStarting(false);

    if (rpcError || !data) {
      setError(transferErrorMessage(rpcError));
      return;
    }
    setResult({ token: data.token, expires_at: data.expires_at, document_count: data.document_count ?? 0 });
  }

  const shareUrl = result ? `${window.location.origin}/bireysel/devir-kabul/${result.token}` : "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // sessizce yoksay
    }
  }

  // İkinci düzeltme turu (madde 3): bireysel self-service sahiplik devri
  // de servis akışıyla AYNI pilot bayrağı arkasında — bu ekran, panel
  // tarafındaki devret ekranından farklı bir DB fonksiyonu (RPC) kullanan
  // TAMAMEN AYRI bir yol olduğu için ayrıca kapatılması gerekiyordu.
  if (!PILOT_FLAGS.ownershipTransferSelfService) {
    return (
      <main style={{ maxWidth: 460, margin: "0 auto", padding: "32px 20px", fontFamily: font, color: colors.textDark, textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>Bu Özellik Şu An Kullanılamıyor</h1>
        <p style={{ color: colors.textMuted, fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
          Araç sahipliği devri, pilot süresi boyunca yalnızca kontrollü destek süreciyle yürütülüyor —
          geri alınamaz kişisel veri etkisi taşıdığı için ek güvenlik adımları tamamlanana kadar
          buradan doğrudan yapılamıyor. Bir devir gerekiyorsa lütfen OTOİZ destek ekibiyle iletişime geçin.
        </p>
        <a href="/bireysel/araclar" style={{ color: colors.greenDark, fontWeight: 700, fontSize: 13.5 }}>
          ← Araçlarıma dön
        </a>
      </main>
    );
  }

  if (loading || !vehicle) return <main className="oz-app" style={{ padding: 24, color: "#A3ABB7" }}>Yükleniyor…</main>;

  const back = <SubHeader title="Aracı Devret" backHref="/bireysel/araclar?bolum=aracim" />;

  if (result) {
    return (
      <main className="oz-app">
        <div className="oz-wrap" style={{ maxWidth: 520, paddingBottom: 40 }}>
          {back}
          <div style={{ textAlign: "center", margin: "8px 0 22px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.45)", boxShadow: "0 0 30px rgba(34,197,94,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Icon name="check" color="#86EFAC" size={28} />
            </div>
            <h1 className="oz-h1" style={{ fontSize: 24, marginBottom: 8 }}>Devir Başlatıldı</h1>
            <p style={{ color: "#A3ABB7", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              <strong style={{ color: "#F5F7FA" }}>{vehicle.plate}</strong> artık hesabınızda görünmüyor. Aşağıdaki bağlantıyı yalnızca aracı devrettiğiniz kişiyle paylaşın.
            </p>
          </div>

          <div className="oz-card" style={{ wordBreak: "break-all", fontSize: 13, fontFamily: "monospace", marginBottom: 14, color: "#F5F7FA" }}>{shareUrl}</div>

          <button onClick={handleCopy} className="oz-btn" style={{ marginBottom: 14 }}>
            {copied ? "Kopyalandı ✓" : "Bağlantıyı Kopyala"}
          </button>

          <div className="oz-card" style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 20, padding: 16 }}>
            <span style={{ flex: "none", display: "inline-flex" }}><Icon name="shield-check" color="#86EFAC" size={18} /></span>
            <p style={{ fontSize: 13, color: "#C9CFD7", margin: 0, lineHeight: 1.6 }}>
              Teknik araç geçmişi yeni sahibine aktarılır; kişisel bilgileriniz aktarılmaz. Belgelerden yalnız seçtikleriniz ({result.document_count ?? 0}) devir kabul edildiğinde yeni sahibe açılır. Bağlantı tek kullanımlıktır ve 72 saat geçerlidir; bu bağlantı
              yalnız şimdi gösterilir, kaydedin. Karşı taraf kabul etmediyse ana ekrandaki "Bekleyen Devirler"
              bölümünden devri iptal edip aracı geri alabilirsiniz.
            </p>
          </div>

          <button onClick={() => router.push("/bireysel/araclar")} className="oz-btn is-ghost">
            Araçlarıma Dön
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="oz-app">
      <div className="oz-wrap" style={{ maxWidth: 560, paddingBottom: "calc(env(safe-area-inset-bottom) + 40px)" }}>
        {back}

        <section className="oz-card" style={{ padding: "26px 18px 22px", textAlign: "center" }} aria-labelledby="devir-baslik">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <Icon name="secure-transfer" color="#4ADE80" size={46} />
          </div>
          <h2 id="devir-baslik" style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Aracınızı Güvenle Devredin</h2>
          <p style={{ fontSize: 13, color: "#A3ABB7", lineHeight: 1.55, margin: "8px auto 0", maxWidth: 300 }}>
            Aracınızı yeni sahibine devrederken istediğiniz belgeleri seçebilirsiniz.
          </p>
          <div style={{ fontSize: 13, color: "#C3C9D1", marginTop: 12 }}>
            <strong style={{ color: "#fff" }}>{vehicle.plate}</strong>
            {[vehicle.brand, vehicle.model].filter(Boolean).length > 0 && <> — {[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}</>}
          </div>
          <ol className="oz-steps" data-testid="devir-adimlari" style={{ maxWidth: 300, marginLeft: "auto", marginRight: "auto" }}>
            {STEPS.map((t, i) => (
              <li key={t}>
                <span className="oz-step-n" aria-hidden="true">
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
        </section>

        <section data-testid="devir-belgeler" className="oz-card" style={{ marginTop: 14, padding: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>{TRANSFER_DOCS_TITLE}</h2>
          <p style={{ fontSize: 12.5, color: "#A3ABB7", margin: "0 0 12px", lineHeight: 1.55 }}>{TRANSFER_DOCS_HINT}</p>
          {docs === null ? (
            <div className="otoiz-skeleton" style={{ height: 48, borderRadius: 14 }} />
          ) : docs.length === 0 ? (
            <p data-testid="devir-belge-yok" style={{ fontSize: 13.5, color: "#A3ABB7", margin: 0 }}>
              {docsError ? "Belgeler şu an yüklenemedi; devir belgesiz başlatılır." : TRANSFER_DOCS_EMPTY}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {docs.map((d: any) => (
                <label
                  key={d.id}
                  data-testid="devir-belge-satir"
                  style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52, padding: "8px 12px", borderRadius: 12, background: "#171A1F", border: `1px solid ${selected.includes(d.id) ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.07)"}`, fontSize: 13.5, color: "#F5F7FA", cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    data-testid="devir-belge-secim"
                    value={d.id}
                    checked={selected.includes(d.id)}
                    onChange={() => setSelected((cur) => toggleDocumentSelection(cur, d.id))}
                    style={{ width: 20, height: 20, accentColor: "#22C55E" }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600 }}>{DOC_TYPE_LABELS[d.doc_type] || "Belge"}</span>
                    <span style={{ display: "block", fontSize: 12, color: "#A3ABB7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[d.file_name, d.doc_date, d.note].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </label>
              ))}
              <p data-testid="devir-belge-sayac" style={{ fontSize: 12.5, color: "#A3ABB7", margin: "4px 0 0" }}>
                {selected.length} belge seçildi
              </p>
            </div>
          )}
        </section>

        <p className="oz-note" style={{ margin: "16px 2px 16px" }}>
          <Icon name="shield-check" color="#4ADE80" size={18} />
          <span>
            Teknik araç geçmişi ve aktif QR araçla birlikte yeni sahibine geçer. Kişisel bilgileriniz aktarılmaz; belgelerinizden yalnız yukarıda seçtikleriniz aktarılır. Devir tamamlandığında bu araca erişiminiz sona erer. Kabul edilmeden önce devri iptal edip aracı geri alabilirsiniz.
          </span>
        </p>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#A3ABB7", marginBottom: 18, lineHeight: 1.5 }}>
          <input type="checkbox" checked={confirming} onChange={(e) => setConfirming(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, accentColor: "#22C55E", flex: "none" }} />
          Teknik araç geçmişinin yeni sahibine geçeceğini, kişisel bilgilerimin aktarılmayacağını, belgelerimden yalnız seçtiklerimin aktarılacağını ve devir tamamlandığında araç erişimimin sona ereceğini anladım; devri başlatmayı onaylıyorum.
        </label>

        {error && <p role="alert" style={{ color: "#F87171", fontSize: 13.5, marginBottom: 12 }}>{error}</p>}

        <button onClick={handleStart} disabled={!confirming || starting} className="oz-btn">
          {starting ? "Başlatılıyor…" : "Devir İşlemini Başlat"}
        </button>
      </div>
    </main>
  );
}
