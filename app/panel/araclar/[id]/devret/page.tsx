"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
const { prepareOwnershipTransfer } = require("@/lib/logic");

export default function OwnershipTransferPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createBrowserSupabase();

  const [newOwner, setNewOwner] = useState({ full_name: "", phone: "", email: "" });
  const [kmAtTransfer, setKmAtTransfer] = useState("");
  const [confirmErase, setConfirmErase] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleTransfer() {
    if (!confirmErase) {
      alert("Devam etmeden önce, önceki sahibin kişisel verilerinin silineceğini onaylamalısınız.");
      return;
    }
    setSaving(true);

    const { data: session } = await supabase.auth.getSession();
    const { data: staff } = await supabase
      .from("staff_users")
      .select("tenant_id")
      .eq("id", session.session?.user.id)
      .single();

    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("id, customer_id, current_km")
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

    await supabase.from("ownership_transfers").insert({
      vehicle_id: params.id,
      tenant_id: staff?.tenant_id,
      previous_customer_snapshot: anonymizedSnapshot,
      previous_customer_data_erased: fieldsToErase.length > 0,
      new_customer_id: createdCustomer?.id,
      km_at_transfer: kmAtTransfer ? Number(kmAtTransfer) : vehicle?.current_km,
      performed_by: session.session?.user.id,
    });

    await supabase.from("vehicles").update({ customer_id: createdCustomer?.id }).eq("id", params.id);

    if (previousCustomer && fieldsToErase.length > 0) {
      await supabase
        .from("customers")
        .update({ full_name: "Devredilmiş Kayıt", phone: null, email: null })
        .eq("id", previousCustomer.id);
    }

    await fetch("/api/audit-log", {
      method: "POST",
      body: JSON.stringify({ action: "ownership.transfer", target_table: "vehicles", target_id: params.id }),
    }).catch(() => {});

    setSaving(false);
    router.push(`/panel/araclar/${params.id}`);
  }

  const inputStyle = { width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc", marginBottom: 10 };

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20 }}>Araç Sahipliğini Devret</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
        Bu araç yeni bir sahibe geçtiğinde bu ekranı kullanın. <strong>Bakım geçmişi ve QR/NFC kodu değişmeden korunur</strong> — sadece
        önceki sahibin kişisel verisi (ad, telefon, e-posta) sistemden temizlenir.
      </p>

      <h2 style={{ fontSize: 15, color: "#888" }}>Yeni Sahip Bilgileri</h2>
      <input placeholder="Ad Soyad" style={inputStyle} value={newOwner.full_name} onChange={(e) => setNewOwner({ ...newOwner, full_name: e.target.value })} />
      <input placeholder="Telefon" style={inputStyle} value={newOwner.phone} onChange={(e) => setNewOwner({ ...newOwner, phone: e.target.value })} />
      <input placeholder="E-posta (opsiyonel)" style={inputStyle} value={newOwner.email} onChange={(e) => setNewOwner({ ...newOwner, email: e.target.value })} />
      <input type="number" placeholder="Devir anındaki kilometre" style={inputStyle} value={kmAtTransfer} onChange={(e) => setKmAtTransfer(e.target.value)} />

      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#555", margin: "12px 0" }}>
        <input type="checkbox" checked={confirmErase} onChange={(e) => setConfirmErase(e.target.checked)} style={{ marginTop: 3 }} />
        Önceki sahibin kişisel verilerinin (ad, telefon, e-posta) kalıcı olarak silineceğini ve bu işlemin geri alınamayacağını onaylıyorum.
        Bakım geçmişi kayıtları etkilenmeyecektir.
      </label>

      <button
        onClick={handleTransfer}
        disabled={saving}
        style={{ width: "100%", padding: 12, background: "#1E3A5F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
      >
        {saving ? "İşleniyor…" : "Devri Tamamla"}
      </button>
    </main>
  );
}
