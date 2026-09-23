"use client";

import { PILOT_FLAGS } from "@/lib/pilotFlags";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, radius, inputStyle, secondaryButtonStyle } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";

const { plateSearchKey, describeMaintenancePlan } = require("@/lib/logic");

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notStaffAccount, setNotStaffAccount] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.push("/panel/login");
        return;
      }

      const { data: staff, error: staffError } = await supabase
        .from("staff_users")
        .select("tenant_id")
        .eq("id", session.session.user.id)
        .single();

      if (staffError || !staff?.tenant_id) {
        setNotStaffAccount(true);
        setLoading(false);
        return;
      }

      const { data: vehicleList } = await supabase
        .from("vehicles")
        .select("*")
        .eq("tenant_id", staff.tenant_id)
        .order("created_at", { ascending: false });

      setVehicles(vehicleList ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/panel/login");
  }

  // PILOT FIX 03 (madde A2): arama ayraçtan (boşluk/tire) ve büyük/küçük
  // harften tamamen bağımsız çalışsın — "otoiz01" yazan kullanıcı "06 OTOIZ
  // 01" olarak kayıtlı aracı da bulabilmeli.
  const filtered = vehicles.filter((v) => plateSearchKey(v.plate).includes(plateSearchKey(search)));

  if (loading) return <main style={{ padding: 24, textAlign: "center", color: colors.textMuted, fontFamily: font }}>Yükleniyor…</main>;

  if (notStaffAccount) {
    return (
      <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 20px", fontFamily: font, textAlign: "center" }}>
        <h1 style={{ fontSize: 20, color: colors.textDark }}>Bu Hesap Bir İşletme Hesabı Değil</h1>
        <p style={{ color: colors.textMuted, lineHeight: 1.6, marginBottom: 20 }}>
          Giriş yaptığınız hesap herhangi bir servis/işletmeye bağlı değil. Bireysel araç sahibiyseniz
          bireysel giriş sayfasını kullanın; işletme hesabınız yoksa yeni bir tane oluşturabilirsiniz.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 260, margin: "0 auto" }}>
          <a href="/bireysel/giris" style={{ padding: "10px 16px", background: colors.green, color: colors.textDark, borderRadius: radius.sm, textDecoration: "none", fontWeight: 700 }}>
            Bireysel Girişe Geç
          </a>
          <a href="/panel/kayit" style={{ padding: "10px 16px", border: `1px solid ${colors.border}`, color: colors.textDark, borderRadius: radius.sm, textDecoration: "none", fontWeight: 600 }}>
            İşletme Hesabı Oluştur
          </a>
          <button onClick={handleLogout} style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: 13, marginTop: 6 }}>
            Çıkış yap
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font }}>
      <div style={{ background: colors.surfaceDark, padding: "16px 18px 18px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <OtoizLogo variant="dark" size={255} />
          <div style={{ fontSize: 13, textAlign: "right" }}>
            <a href="/panel/ayarlar" style={{ color: "rgba(255,255,255,0.65)", marginRight: 8, textDecoration: "none", display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 8px" }}>Ayarlar</a>
            <button onClick={handleLogout} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.65)", cursor: "pointer", fontSize: 13, padding: "0 8px", minHeight: 44 }}>Çıkış yap</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 40px" }}>
        <h1 style={{ fontSize: 20, margin: "0 0 14px", color: colors.textDark, fontWeight: 800 }}>Plaka Ara</h1>

        <input
          placeholder="Plaka ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          style={{ ...inputStyle, marginBottom: 16, padding: "14px 16px", fontSize: 17, boxShadow: "0 6px 18px rgba(6,20,33,0.06)" }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
          <a href="/panel/araclar/yeni" style={{ display: "inline-block", padding: "12px 20px", background: colors.green, color: colors.textDark, borderRadius: radius.sm, textDecoration: "none", fontWeight: 700, minHeight: 44 }}>
            + Yeni Araç Ekle
          </a>
          {PILOT_FLAGS.qrMatchingSelfService && (
            <a href="/panel/eslestir" style={{ ...secondaryButtonStyle(), width: "auto", display: "inline-block", textDecoration: "none", padding: "12px 20px" }}>
              Anahtarlık Eşleştir
            </a>
          )}
          {PILOT_FLAGS.bulkQrGeneration && (
            <a href="/panel/qr-uretim" style={{ ...secondaryButtonStyle(), width: "auto", display: "inline-block", textDecoration: "none", padding: "12px 20px", color: colors.textMuted, borderColor: colors.border }}>
              QR Üret
            </a>
          )}
        </div>

        {filtered.length === 0 && (
          <p style={{ color: colors.textMuted, marginTop: 20 }}>Araç bulunamadı.</p>
        )}

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((v) => (
            <li key={v.id} style={{ background: colors.surfaceLight, borderRadius: radius.md, border: `1px solid ${colors.border}` }}>
              <a href={`/panel/araclar/${v.id}`} style={{ display: "block", textDecoration: "none", color: colors.textDark, padding: "14px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{v.plate}</div>
                <div style={{ color: colors.textMuted, fontSize: 12.5 }}>
                  {v.brand} {v.model} · {v.current_km?.toLocaleString("tr-TR")} km · Sonraki bakım:{" "}
                  {describeMaintenancePlan({ nextServiceKm: v.next_service_km, nextServiceDate: v.next_service_date }).label}
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
