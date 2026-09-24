"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, inputStyle, primaryButtonStyle } from "@/lib/theme";
import { PILOT_FLAGS } from "@/lib/pilotFlags";
const { prepareOwnershipTransfer } = require("@/lib/logic");

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
  if (!PILOT_FLAGS.serviceOwnershipTransfer) {
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

    // ÜÇÜNCÜ düzeltme turu (madde 6): ikinci turda bu akış geçici olarak
    // /api/ownership-transfer'a taşınmıştı. İncelemede bu route'un GERÇEK
    // bir güvenlik sınırı EKLEMEDİĞİ ortaya çıktı: ownership_transfers/
    // customers/vehicles üzerindeki RLS politikaları ("staff_own_tenant_
    // transfers" vb.) zaten aynı tenant-kapsamlı yazmaya izin veriyor —
    // route'un servis-rolü kullanması yalnızca ekstra, gereksiz saldırı
    // yüzeyi (yeni bir POST uç noktası) yaratıyordu, PILOT_FLAGS
    // kontrolünü atlatmayı ENGELLEMİYORDU (bkz. final rapor). Bu yüzden
    // route silindi, akış RLS'ye tabi doğrudan istemci çağrılarına geri
    // döndürüldü — güvenlik sınırı zaten her zaman RLS'ydi, değişmedi.
    // Gerçek koruma yalnızca aşağıdaki UI seviyesi PILOT_FLAGS kontrolü
    // (bu dosyanın başında) ile sağlanıyor; bu, normal uygulama akışını
    // kapatır ama doğrudan Supabase çağrısı yapan teknik bir kullanıcıyı
    // DURDURMAZ — tam kapatma için RLS/EXECUTE değişikliği gerekir (bkz.
    // SECURITY_FIX_04_PROPOSAL.md, uygulanmadı).
    const { data: session } = await supabase.auth.getSession();
    const { data: staff } = await supabase
      .from("staff_users")
      .select("tenant_id")
      .eq("id", session.session?.user.id)
      .single();

    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("id, customer_id, current_km, owner_user_id")
      .eq("id", params.id)
      .single();

    let previousCustomer = null;
    if (vehicle?.customer_id) {
      const { data: c } = await supabase.from("customers").select("*").eq("id", vehicle.customer_id).single();
      previousCustomer = c;
    }

    const transferDate = new Date().toISOString().slice(0, 10);
    const { anonymizedSnapshot, fieldsToErase } = prepareOwnershipTransfer(previousCustomer, transferDate);

    const { data: createdCustomer } = await supabase
      .from("customers")
      .insert({ tenant_id: staff?.tenant_id, ...newOwner })
      .select()
      .single();

    // Önceki sahibin uygulama hesabı varsa (owner_user_id) devir kaydına
    // düşülüyor; yeni sahip için henüz doğrulanmış bir OTOİZ hesabı
    // bilinmediğinden new_owner_user_id bilerek boş bırakılıyor — rastgele
    // bir kullanıcıya araç erişimi verilmiyor, hesap eşleşmesi ileride ayrı
    // bir "devri kabul et" akışıyla yapılmalı.
    await supabase.from("ownership_transfers").insert({
      vehicle_id: params.id,
      tenant_id: staff?.tenant_id,
      previous_customer_snapshot: anonymizedSnapshot,
      previous_customer_data_erased: fieldsToErase.length > 0,
      new_customer_id: createdCustomer?.id,
      km_at_transfer: kmAtTransfer ? Number(kmAtTransfer) : vehicle?.current_km,
      performed_by: session.session?.user.id,
      previous_owner_user_id: vehicle?.owner_user_id ?? null,
      new_owner_user_id: null,
    });

    // Eski sahibin uygulama üzerinden bu araca erişimi hemen kesiliyor.
    // Teknik geçmiş (maintenance_records/maintenance_items) vehicle_id
    // üzerinden korunmaya devam ediyor, yalnızca erişim yetkisi kaldırılıyor.
    await supabase.from("vehicles").update({ customer_id: createdCustomer?.id, owner_user_id: null }).eq("id", params.id);

    if (previousCustomer && fieldsToErase.length > 0) {
      await supabase
        .from("customers")
        .update({ full_name: "Devredilmiş Kayıt", phone: null, email: null })
        .eq("id", previousCustomer.id);
    }

    // Not: bu olay istemcinin ayrı bir çağrısına değil, ownership_transfers
    // insert'ini yakalayan DB tetikleyicisine (log_ownership_transfer) güveniyor.

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
