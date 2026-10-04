"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, radius, cardStyle, primaryButtonStyle, secondaryButtonStyle } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { PILOT_FLAGS } from "@/lib/pilotFlags";

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

const STEPS = [
  { n: 1, title: "Devir Detaylarını Gir", desc: "Devri başlatın, aracın erişimi hesabınızdan kaldırılır." },
  { n: 2, title: "Güvenli Bağlantı Oluştur", desc: "Yalnızca paylaştığınız kişi kullanabilecek, süreli bir bağlantı." },
  { n: 3, title: "Alıcı Kabul Eder", desc: "OTOİZ hesabıyla giriş yapıp bağlantıyı açtığında devir tamamlanır." },
  { n: 4, title: "Teknik Geçmiş Devam Eder", desc: "Bakım kayıtları ve QR kodu araçla birlikte korunur; kişisel bilgiler aktarılmaz; belgelerden yalnız seçtikleriniz aktarılır." },
];

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

  if (loading || !vehicle) return <main style={{ padding: 24, fontFamily: font, color: colors.textMuted }}>Yükleniyor…</main>;

  if (result) {
    return (
      <main style={{ minHeight: "100vh", background: colors.bg, fontFamily: font }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "40px 20px" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: colors.greenSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Icon name="check" color={colors.greenDark} size={24} />
            </div>
            <h1 style={{ fontSize: 20, marginBottom: 6, color: colors.textDark, fontWeight: 800 }}>Devir Başlatıldı</h1>
            <p style={{ color: colors.textMuted, fontSize: 13.5, lineHeight: 1.6 }}>
              <strong>{vehicle.plate}</strong> artık hesabınızda görünmüyor. Aşağıdaki bağlantıyı yalnızca aracı devrettiğiniz kişiyle paylaşın.
            </p>
          </div>

          <div style={{ ...cardStyle, wordBreak: "break-all", fontSize: 13, fontFamily: "monospace", marginBottom: 14, background: colors.surfaceSoft }}>
            {shareUrl}
          </div>

          <button onClick={handleCopy} style={{ ...primaryButtonStyle(false), marginBottom: 14 }}>
            {copied ? "Kopyalandı ✓" : "Bağlantıyı Kopyala"}
          </button>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: colors.greenSoft, borderRadius: radius.md, padding: 14, marginBottom: 20 }}>
            <Icon name="shield-check" color={colors.greenDark} size={16} strokeWidth={2.5} />
            <p style={{ fontSize: 12.5, color: colors.textDark, margin: 0, lineHeight: 1.6 }}>
              Teknik araç geçmişi yeni sahibine aktarılır; kişisel bilgileriniz aktarılmaz. Belgelerden yalnız seçtikleriniz ({result.document_count ?? 0}) devir kabul edildiğinde yeni sahibe açılır. Bağlantı tek kullanımlıktır ve 72 saat geçerlidir; bu bağlantı
              yalnız şimdi gösterilir, kaydedin. Karşı taraf kabul etmediyse araç listenizdeki "Bekleyen Devirler"
              bölümünden devri iptal edip aracı geri alabilirsiniz.
            </p>
          </div>

          <button onClick={() => router.push("/bireysel/araclar")} style={secondaryButtonStyle()}>
            Araçlarıma Dön
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: colors.bg, fontFamily: font }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: colors.greenSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Icon name="handover" color={colors.greenDark} size={28} />
        </div>
        <h1 style={{ fontSize: 21, marginBottom: 4, color: colors.textDark, fontWeight: 800, textAlign: "center" }}>Aracı Devret / Elden Çıkar</h1>
        <p style={{ color: colors.textMuted, fontSize: 14, marginBottom: 24, textAlign: "center" }}>
          <strong style={{ color: colors.textDark }}>{vehicle.plate}</strong> — {vehicle.brand} {vehicle.model}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 30, height: 30, minWidth: 30, borderRadius: "50%", background: colors.surfaceDark, color: colors.green, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>
                {s.n}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: colors.textDark }}>{s.title}</div>
                <div style={{ fontSize: 12.5, color: colors.textMuted, lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: colors.greenSoft, borderRadius: radius.md, padding: 14, marginBottom: 22, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <Icon name="shield-check" color={colors.greenDark} size={16} strokeWidth={2.5} />
          <p style={{ fontSize: 12.5, color: colors.textDark, margin: 0, lineHeight: 1.6 }}>
            Teknik araç geçmişi ve aktif QR araçla birlikte yeni sahibine geçer. Kişisel bilgileriniz aktarılmaz; belgelerinizden yalnız aşağıda seçtikleriniz aktarılır. Devir tamamlandığında bu araca erişiminiz sona erer. Kabul edilmeden önce devri iptal edip aracı geri alabilirsiniz.
          </p>
        </div>

        <section data-testid="devir-belgeler" style={{ ...cardStyle, marginBottom: 22 }}>
          <h2 style={{ fontSize: 15.5, fontWeight: 800, color: colors.textDark, margin: "0 0 6px" }}>{TRANSFER_DOCS_TITLE}</h2>
          <p style={{ fontSize: 12.5, color: colors.textMuted, margin: "0 0 12px", lineHeight: 1.55 }}>{TRANSFER_DOCS_HINT}</p>
          {docs === null ? (
            <div className="otoiz-skeleton" style={{ height: 48, borderRadius: radius.md }} />
          ) : docs.length === 0 ? (
            <p data-testid="devir-belge-yok" style={{ fontSize: 13.5, color: colors.textMuted, margin: 0 }}>
              {docsError ? "Belgeler şu an yüklenemedi; devir belgesiz başlatılır." : TRANSFER_DOCS_EMPTY}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {docs.map((d: any) => (
                <label
                  key={d.id}
                  data-testid="devir-belge-satir"
                  style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "8px 10px", borderRadius: radius.sm, background: colors.surfaceSoft, fontSize: 13.5, color: colors.textDark, cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    data-testid="devir-belge-secim"
                    value={d.id}
                    checked={selected.includes(d.id)}
                    onChange={() => setSelected((cur) => toggleDocumentSelection(cur, d.id))}
                    style={{ width: 20, height: 20 }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 700 }}>{DOC_TYPE_LABELS[d.doc_type] || "Belge"}</span>
                    <span style={{ display: "block", fontSize: 12, color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[d.file_name, d.doc_date, d.note].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </label>
              ))}
              <p data-testid="devir-belge-sayac" style={{ fontSize: 12.5, color: colors.textMuted, margin: "4px 0 0" }}>
                {selected.length} belge seçildi
              </p>
            </div>
          )}
        </section>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: colors.textMuted, marginBottom: 20 }}>
          <input type="checkbox" checked={confirming} onChange={(e) => setConfirming(e.target.checked)} style={{ marginTop: 3 }} />
          Teknik araç geçmişinin yeni sahibine geçeceğini, kişisel bilgilerimin aktarılmayacağını, belgelerimden yalnız seçtiklerimin aktarılacağını ve devir tamamlandığında araç erişimimin sona ereceğini anladım; devri başlatmayı onaylıyorum.
        </label>

        {error && <p role="alert" style={{ color: colors.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button onClick={handleStart} disabled={!confirming || starting} style={primaryButtonStyle(!confirming || starting)}>
          {starting ? "Başlatılıyor…" : "Devri Başlat"}
        </button>
      </div>
    </main>
  );
}
