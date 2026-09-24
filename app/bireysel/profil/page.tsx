"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, radius, secondaryButtonStyle } from "@/lib/theme";
import { Icon } from "@/components/Icon";
import { BottomNav } from "@/components/BottomNav";
const { accountCodeFromUserId } = require("@/lib/passwordPolicy");

export default function ProfilPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [email, setEmail] = useState<string | null>(null);
  const [accountCode, setAccountCode] = useState<string>("");
  const [vehicleCount, setVehicleCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/bireysel/giris");
        return;
      }
      setEmail(session.session.user.email ?? null);
      setAccountCode(accountCodeFromUserId(session.session.user.id));
      const { count } = await supabase
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", session.session.user.id);
      setVehicleCount(count ?? 0);
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut({ scope: "local" });
    router.push("/bireysel/giris");
  }

  if (loading) {
    return <main style={{ padding: 24, textAlign: "center", color: colors.textMuted, fontFamily: font }}>Yükleniyor…</main>;
  }

  const initial = email ? email[0].toUpperCase() : "?";

  return (
    <main className="otoiz-has-bottom-nav" style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font }}>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "28px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 26 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: colors.green, color: colors.textDark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
            {initial}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.textDark }}>{email}</div>
          <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 2 }}>Bireysel Kullanıcı hesabı</div>
        </div>

        {/* 2026-09-24: OTOİZ anahtarlığı satın alırken satıcıya gösterilen
            hesap kodu — yönetici QR'ı yalnız e-posta + bu kod eşleşirse
            hesaba tanımlayabilir. */}
        <div style={{ background: colors.surfaceLight, borderRadius: radius.lg, border: `1px solid ${colors.border}`, padding: 16, marginBottom: 14, textAlign: "center" }}>
          <div style={{ fontSize: 11.5, color: colors.textMuted, fontWeight: 700, letterSpacing: 0.4 }}>HESAP KODUNUZ</div>
          <div data-testid="account-code" style={{ fontSize: 26, fontWeight: 900, letterSpacing: 3, color: colors.textDark, margin: "4px 0" }}>{accountCode}</div>
          <div style={{ fontSize: 12, color: colors.textMuted }}>OTOİZ anahtarlığı alırken bu kodu satıcıya gösterin.</div>
        </div>

        <div style={{ background: colors.surfaceLight, borderRadius: radius.lg, border: `1px solid ${colors.border}`, padding: 16, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "#E6FAEE", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="car" color={colors.greenDark} size={17} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.textDark }}>{vehicleCount} Araç</div>
            <div style={{ fontSize: 12, color: colors.textMuted }}>hesabınıza kayıtlı</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a href="/bireysel/araclar" style={{ ...secondaryButtonStyle(), textDecoration: "none", display: "block", textAlign: "center" }}>
            Araçlarımı Görüntüle
          </a>
          <a href="/hesap/sifremi-unuttum" style={{ ...secondaryButtonStyle(), textDecoration: "none", display: "block", textAlign: "center" }}>
            Şifremi Değiştir
          </a>
          <button onClick={handleLogout} style={{ ...secondaryButtonStyle(), color: colors.danger, borderColor: colors.danger }}>
            Çıkış Yap
          </button>
        </div>
      </div>

      <BottomNav active="profile" />
    </main>
  );
}
