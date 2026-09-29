"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, primaryButtonStyle } from "@/lib/theme";
import { PublicPassportView, PublicPassportMessage, type PublicPassportData } from "@/components/PublicPassportView";

// Bu sayfa herkese açık olduğundan service role yerine anon key kullanır;
// get_public_vehicle_passport() SECURITY DEFINER fonksiyonu anon rolüne
// EXECUTE ile açıktır ve döndürdüğü alanları kendi içinde sınırlar. Tüm
// qr_keys/vehicles/tenants tablolarını doğrudan okumak yerine, yalnızca
// verilen kod geçerliyse (ve iptal edilmemişse) minimum pasaport verisini
// döndüren bu güvenli DB fonksiyonu çağrılıyor.
//
// Diğer tüm sayfalarla tutarlı olması ve gerçek ekranın Playwright'ta
// fixture veriyle (bkz. e2e/fixtures/mockAuth.ts) test edilebilmesi için
// istemci tarafında (createBrowserSupabase) çağrılıyor — sunucu bileşeninden
// istemci bileşenine geçiş yalnızca VERİNİN NEREDE ÇEKİLDİĞİNİ değiştirir;
// RPC, anon key, RLS ve güvenlik modeli birebir aynı kalır.
export default function PassportByCodePage() {
  const params = useParams();
  const code = params.code as string;
  const [status, setStatus] = useState<"loading" | "invalid" | "unassigned" | "ready">("loading");
  const [activatable, setActivatable] = useState(false);
  const [passport, setPassport] = useState<PublicPassportData | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabase();
      const { data } = await supabase.rpc("get_public_vehicle_passport", { p_code: code });

      if (!data) {
        setStatus("invalid");
        return;
      }
      if (data.status === "unassigned") {
        setActivatable(data.activatable === true);
        setStatus("unassigned");
        return;
      }
      setPassport(data as PublicPassportData);
      setStatus("ready");
    }
    load();
  }, [code]);

  if (status === "loading") {
    return <main style={{ padding: 24, textAlign: "center", color: colors.textMuted, fontFamily: font }}>Yükleniyor…</main>;
  }
  if (status === "invalid") {
    return <PublicPassportMessage title="Geçersiz Kod" body="Bu QR kod sistemde tanımlı değil." />;
  }
  if (status === "unassigned" && activatable) {
    // Faz 3: yeni ürün (aktivasyon kodlu) → self-aktivasyon. Resolver ve
    // /p/ adresi değişmez; yalnız bu ekran bir sonraki adımı gösterir.
    return <ActivatePrompt code={code} />;
  }
  if (status === "unassigned") {
    return <PublicPassportMessage title="Henüz Eşleştirilmemiş" body="Bu anahtarlık henüz bir araca bağlanmamış." />;
  }

  return (
    <>
      <ViewerShortcut code={code} />
      <PublicPassportView passport={passport!} />
    </>
  );
}

// Aşama E — "Plaka / QR → KM → işlemler → Kaydet": anahtarlığı okutan kişi
// giriş yapmış ONAYLI servis personeli ya da araç sahibiyse, pasaportun
// üstünde tek dokunuşluk kısayol çıkar. Yetkisiz/anonim ziyaretçi için
// hiçbir şey değişmez (RPC null döner, istek bile yalnız oturum varsa gider).
function ViewerShortcut({ code }: { code: string }) {
  const [target, setTarget] = useState<{ href: string; label: string } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createBrowserSupabase();
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const { data } = await supabase.rpc("vehicle_for_qr_viewer", { p_code: code });
      if (!alive || !data || typeof data !== "object" || Array.isArray(data) || !data.vehicle_id) return;
      if (data.role === "service") setTarget({ href: `/panel/araclar/${data.vehicle_id}`, label: "Hızlı Bakım Kaydı Gir" });
      else if (data.role === "owner") setTarget({ href: `/bireysel/araclar/${data.vehicle_id}`, label: "Aracımı Aç" });
    })();
    return () => {
      alive = false;
    };
  }, [code]);
  if (!target) return null;
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 20, background: colors.surfaceDark, padding: "10px 16px", fontFamily: font }}>
      <a
        href={target.href}
        data-testid="qr-kisayol"
        style={{ ...primaryButtonStyle(false), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", maxWidth: 520, margin: "0 auto" }}
      >
        {target.label}
      </a>
    </div>
  );
}

function ActivatePrompt({ code }: { code: string }) {
  return (
    <main style={{ minHeight: "100vh", background: colors.bg, fontFamily: font, display: "flex", alignItems: "center" }}>
      <div style={{ maxWidth: 420, width: "100%", margin: "0 auto", padding: "0 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: 21, color: colors.textDark, fontWeight: 800, marginBottom: 8 }}>Yeni OTOİZ anahtarlığı</h1>
        <p style={{ color: colors.textMuted, lineHeight: 1.55, margin: "0 0 20px" }}>
          Bu anahtarlık henüz bir araca bağlı değil. Paketteki aktivasyon kodu ile birkaç adımda aracına bağla.
        </p>
        <a
          href={`/aktivasyon?t=${encodeURIComponent(code)}`}
          data-testid="activate-cta"
          style={{ ...primaryButtonStyle(false), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
        >
          Anahtarlığı etkinleştir
        </a>
      </div>
    </main>
  );
}
