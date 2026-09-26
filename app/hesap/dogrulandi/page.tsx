"use client";

// OTOİZ Faz 3.1 — e-posta doğrulama bağlantısının dönüş sayfası.
//
// Doğrulamayı bu sayfa YAPMAZ: kullanıcı e-postadaki bağlantıya bastığında
// Supabase Auth (/auth/v1/verify) hesabı doğrular ve buraya yönlendirir.
// Bu sayfa yalnız sonucu (#hash) okur ve kullanıcıyı girişe yönlendirir.
// Hash'teki oturum bilgileri kullanılmaz ve adres çubuğundan hemen silinir;
// kullanıcı normal giriş yapar. Başarı bilgisi yalnız mesaj içindir, hiçbir
// yetki kararı buna bağlı değildir (activate_product sunucuda kontrol eder).

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { colors, font, primaryButtonStyle } from "@/lib/theme";
import { OtoizLogo } from "@/components/OtoizLogo";
import { ResendConfirmation } from "@/components/ResendConfirmation";
const { parseConfirmHash, safeNext } = require("@/lib/emailConfirm");

function Inner() {
  const params = useSearchParams();
  const next = safeNext(params.get("next") || "") || "/bireysel/araclar";
  const [state, setState] = useState<"loading" | "ok" | "error" | "unknown">("loading");

  useEffect(() => {
    const r = parseConfirmHash(window.location.hash);
    // Token'lar tarayıcı geçmişinde / ekran görüntüsünde kalmasın.
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setState(r.ok === true ? "ok" : r.ok === false ? "error" : "unknown");
  }, []);

  const loginHref = `/bireysel/giris?next=${encodeURIComponent(next)}`;

  return (
    <main style={{ minHeight: "100vh", background: colors.surfaceSoft, fontFamily: font, padding: "40px 20px" }}>
      <div style={{ maxWidth: 380, margin: "0 auto", background: colors.surfaceLight, borderRadius: 18, padding: "26px 22px", boxShadow: "0 12px 40px rgba(6,20,33,0.14)" }}>
        <OtoizLogo variant="light" size={140} />
        {state === "loading" && <p style={{ color: colors.textMuted }}>Kontrol ediliyor…</p>}
        {state === "ok" && (
          <div data-testid="confirm-ok">
            <h1 style={{ fontSize: 21, margin: "16px 0 8px", color: colors.textDark, fontWeight: 800 }}>E-postan doğrulandı</h1>
            <p style={{ color: colors.textMuted, lineHeight: 1.55, margin: "0 0 18px" }}>Şimdi giriş yapıp kaldığın yerden devam edebilirsin.</p>
            <a href={loginHref} style={{ ...primaryButtonStyle(false), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>Giriş yap</a>
          </div>
        )}
        {(state === "error" || state === "unknown") && (
          <div data-testid="confirm-error">
            <h1 style={{ fontSize: 21, margin: "16px 0 8px", color: colors.textDark, fontWeight: 800 }}>
              {state === "error" ? "Bağlantı geçersiz veya süresi dolmuş" : "Doğrulama bağlantısı"}
            </h1>
            <p style={{ color: colors.textMuted, lineHeight: 1.55, margin: "0 0 14px" }}>
              Hesabın daha önce doğrulandıysa doğrudan giriş yapabilirsin. Doğrulanmadıysa e-posta adresini yazıp yeni bağlantı iste.
            </p>
            <ResendConfirmation next={next} />
            <p style={{ textAlign: "center", marginTop: 16, fontSize: 13 }}>
              <a href={loginHref} style={{ color: colors.greenDark, fontWeight: 600 }}>Giriş yap</a>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function DogrulandiPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Yükleniyor…</main>}>
      <Inner />
    </Suspense>
  );
}
