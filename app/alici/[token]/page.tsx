"use client";

// OTOİZ — OTOİZ Alıcı Raporu public buyer sayfası.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BuyerReportView } from "@/components/BuyerReportView";
import { colors, font } from "@/lib/theme";

export default function AliciPage() {
  const params = useParams();
  const token = String((params as any).token || "");
  const [state, setState] = useState<"loading" | "ok" | "expired" | "revoked" | "notfound" | "error">("loading");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/alici-raporu/rapor?token=${encodeURIComponent(token)}`);
        if (res.status === 200) {
          setData(await res.json());
          setState("ok");
          return;
        }
        if (res.status === 410) {
          const e = await res.json().catch(() => ({}));
          setState(e?.error === "revoked" ? "revoked" : "expired");
          return;
        }
        if (res.status === 404) { setState("notfound"); return; }
        setState("error");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  if (state === "loading") {
    return (
      <main style={{ minHeight: "100vh", background: colors.bg, color: colors.textMuted, fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>Rapor hazırlanıyor…</p>
      </main>
    );
  }
  if (state === "expired" || state === "revoked" || state === "notfound" || state === "error") {
    const title =
      state === "expired" ? "Paylaşım Süresi Doldu" :
      state === "revoked" ? "Paylaşım Kapatıldı" :
      state === "notfound" ? "Bağlantı Bulunamadı" : "Rapor Yüklenemiyor";
    const body =
      state === "expired" ? "Bu bağlantının süresi doldu. Güncel bir paylaşım linki için araç sahibinden yeni bir bağlantı isteyin." :
      state === "revoked" ? "Bu paylaşım artık aktif değil. Araç sahibi bu bağlantıyı kapatmış olabilir." :
      state === "notfound" ? "Bu bağlantı geçerli görünmüyor. Linki yeniden kontrol edin." :
      "Geçici bir sorun oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin.";
    return (
      <main style={{ minHeight: "100vh", background: colors.bg, fontFamily: font, display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 20px", textAlign: "center" }}>
          <h1 style={{ color: colors.text, fontWeight: 700, fontSize: 22, marginBottom: 10 }}>{title}</h1>
          <p style={{ color: colors.textMuted, lineHeight: 1.6 }}>{body}</p>
        </div>
      </main>
    );
  }
  return <BuyerReportView report={data} />;
}
