"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font } from "@/lib/theme";
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
  if (status === "unassigned") {
    return <PublicPassportMessage title="Henüz Eşleştirilmemiş" body="Bu anahtarlık henüz bir araca bağlanmamış." />;
  }

  return <PublicPassportView passport={passport!} />;
}
