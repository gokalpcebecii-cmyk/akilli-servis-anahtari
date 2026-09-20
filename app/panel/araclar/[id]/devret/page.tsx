"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, inputStyle, primaryButtonStyle } from "@/lib/theme";
import { PILOT_FLAGS } from "@/lib/pilotFlags";

export default function OwnershipTransferPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createBrowserSupabase();

  const [newOwner, setNewOwner] = useState({ full_name: "", phone: "", email: "" });
  const [kmAtTransfer, setKmAtTransfer] = useState("");
  const [confirmErase, setConfirmErase] = useState(false);
  const [saving, setSaving] = useState(false);

  // PILOT FIX 03 (madde A7): geri alınamaz kişisel veri etkisine rağmen
  // bu akış onay kutusu işaretlenmeden erişilebilirdi — canlı testte
  // bulunan pilot-engelleyici gizlilik riski. Kalıcı, güvenli sürüm
  // (etki özeti + alıcı doğrulaması + yeniden kimlik doğrulama + audit)
  // ayrı bir teknik görev; o tamamlanana kadar bu route erişilemez.
  // Veri modeli/mantık DEĞİŞMEDİ — yalnızca UX erişimi kapatıldı.
  if (!PILOT_FLAGS.ownershipTransferSelfService) {
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", fontFamily: font, color: colors.textDark, textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>Bu Özellik Şu An Kullanılamıyor</h1>
        <p style={{ color: colors.textMuted, fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
          Araç sahipliği devri, pilot süresi boyunca yalnızca kontrollü destek süreciyle yürütülüyor —
          geri alınamaz kişisel veri etkisi taşıdığı için ek güvenlik adımları tamamlanana kadar
          buradan doğrudan yapılamıyor. Bir devir gerekiyorsa lütfen OTOİZ destek ekibiyle iletişime geçin.
        </p>
        <a href={`/panel/araclar/${params.id}`} style={{ color: colors.greenDark, fontWeight: 700, fontSize: 13.5 }}>
          ← Araç detayına dön
        </a>
      </main>
    );
  }

  async function handleTransfer() {
    if (!confirmErase) {
      alert("Devam etmeden önce, önceki sahibin kişisel verilerinin silineceğini onaylamalısınız.");
      return;
    }
    setSaving(true);

    // İkinci düzeltme turu (madde 3): çok adımlı doğrudan Supabase
    // yazmaları yerine tek, sunucu tarafında pilot bayrağını VE
    // tenant kapsamını doğrulayan /api/ownership-transfer çağrılıyor
    // (bkz. o route — mantık/veri modeli aynı, yalnızca yazma yolu
    // taşındı ve API seviyesinde de kapatılabilir hale geldi).
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    try {
      const res = await fetch("/api/ownership-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vehicle_id: params.id,
          new_owner: newOwner,
          km_at_transfer: kmAtTransfer,
          confirm_erase: confirmErase,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setSaving(false);
        alert(json.error || "Devir tamamlanamadı.");
        return;
      }
    } catch {
      setSaving(false);
      alert("Bağlantı hatası. Lütfen tekrar deneyin.");
      return;
    }

    setSaving(false);
    router.push(`/panel/araclar/${params.id}`);
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", fontFamily: font, color: colors.textDark }}>
      <h1 style={{ fontSize: 20 }}>Araç Sahipliğini Devret</h1>
      <p style={{ color: colors.textMuted, fontSize: 14, marginBottom: 20 }}>
        Bu araç yeni bir sahibe geçtiğinde bu ekranı kullanın. <strong>Bakım geçmişi ve QR/NFC kodu değişmeden korunur</strong> — sadece
        önceki sahibin kişisel verisi (ad, telefon, e-posta) sistemden temizlenir.
      </p>

      <h2 style={{ fontSize: 15, color: colors.textMuted }}>Yeni Sahip Bilgileri</h2>
      <input placeholder="Ad Soyad" style={{ ...inputStyle, marginBottom: 10 }} value={newOwner.full_name} onChange={(e) => setNewOwner({ ...newOwner, full_name: e.target.value })} />
      <input placeholder="Telefon" style={{ ...inputStyle, marginBottom: 10 }} value={newOwner.phone} onChange={(e) => setNewOwner({ ...newOwner, phone: e.target.value })} />
      <input placeholder="E-posta (opsiyonel)" style={{ ...inputStyle, marginBottom: 10 }} value={newOwner.email} onChange={(e) => setNewOwner({ ...newOwner, email: e.target.value })} />
      <input type="number" placeholder="Devir anındaki kilometre" style={{ ...inputStyle, marginBottom: 10 }} value={kmAtTransfer} onChange={(e) => setKmAtTransfer(e.target.value)} />

      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: colors.textMuted, margin: "12px 0" }}>
        <input type="checkbox" checked={confirmErase} onChange={(e) => setConfirmErase(e.target.checked)} style={{ marginTop: 3 }} />
        Önceki sahibin kişisel verilerinin (ad, telefon, e-posta) kalıcı olarak silineceğini ve bu işlemin geri alınamayacağını onaylıyorum.
        Bakım geçmişi kayıtları etkilenmeyecektir.
      </label>

      <button onClick={handleTransfer} disabled={saving} style={primaryButtonStyle(saving)}>
        {saving ? "İşleniyor…" : "Devri Tamamla"}
      </button>
    </main>
  );
}
