"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import { colors, font, radius, cardStyle } from "@/lib/theme";
const { anonymizeCustomerRecord } = require("@/lib/logic");

export default function DataRequestsPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      router.push("/panel/login");
      return;
    }
    const { data } = await supabase
      .from("data_deletion_requests")
      .select("*, customers(full_name, phone, email)")
      .order("requested_at", { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleComplete(req: any) {
    if (!confirm("Bu müşterinin ad, telefon ve e-posta bilgileri kalıcı olarak silinecek. Bakım geçmişi etkilenmeyecek. Onaylıyor musunuz?")) return;

    const anonymized = anonymizeCustomerRecord();
    await supabase.from("customers").update(anonymized).eq("id", req.customer_id);

    const { data: session } = await supabase.auth.getSession();
    await supabase
      .from("data_deletion_requests")
      .update({ status: "completed", completed_at: new Date().toISOString(), handled_by: session.session?.user.id })
      .eq("id", req.id);

    load();
  }

  if (loading) return <main style={{ padding: 24, textAlign: "center", color: colors.textMuted, fontFamily: font }}>Yükleniyor…</main>;

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px", fontFamily: font, color: colors.textDark }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Veri Silme Talepleri</h1>
      <p style={{ color: colors.textMuted, fontSize: 14, marginBottom: 20 }}>
        KVKK kapsamında bir müşteri kişisel verisinin silinmesini talep ederse buradan işleme alın. Araç ve bakım kayıtları etkilenmez, sadece kişisel bilgiler temizlenir.
      </p>

      {requests.length === 0 && <p style={{ color: colors.textMuted }}>Bekleyen talep yok.</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {requests.map((r) => (
          <li key={r.id} style={{ ...cardStyle, marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>{r.customers?.full_name || "İsimsiz kayıt"}</div>
            <div style={{ fontSize: 13, color: colors.textMuted }}>
              Talep: {new Date(r.requested_at).toLocaleDateString("tr-TR")} · Durum: {r.status === "completed" ? "Tamamlandı" : "Bekliyor"}
            </div>
            {r.status !== "completed" && (
              <button
                onClick={() => handleComplete(r)}
                style={{ marginTop: 8, padding: "8px 14px", background: colors.danger, color: "#fff", border: "none", borderRadius: radius.sm, fontSize: 13, cursor: "pointer", minHeight: 36 }}
              >
                Silme İşlemini Tamamla
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
