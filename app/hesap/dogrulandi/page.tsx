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
import { colors, primaryButtonStyle } from "@/lib/theme";
import { AuthShell, AuthShellLoading } from "@/components/AuthShell";
import { ResendConfirmation } from "@/components/ResendConfirmation";
const { parseConfirmHash, safeNext } = require("@/lib/emailConfirm");
const { SERVICE_COMPLETE_PATH } = require("@/lib/serviceSignup");

function Inner() {
  const params = useSearchParams();
  const next = safeNext(params.get("next") || "") || "/bireysel/araclar";
  const [state, setState] = useState<"loading" | "ok" | "error" | "unknown">("loading");

  useEffect(() => {
    function read() {
      if (!window.location.hash) return;
      const r = parseConfirmHash(window.location.hash);
      // P0: servis kaydında şifre, doğrulama bağlantısının açtığı oturumla
      // belirlenir. Oturum bilgisi YALNIZ bu sabit site içi sayfaya aktarılır.
      if (r.ok === true && next === SERVICE_COMPLETE_PATH && window.location.hash.includes("access_token=")) {
        window.location.replace(SERVICE_COMPLETE_PATH + window.location.hash);
        return;
      }
      // Token'lar tarayıcı geçmişinde / ekran görüntüsünde kalmasın.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setState(r.ok === true ? "ok" : r.ok === false ? "error" : "unknown");
    }
    if (window.location.hash) read();
    else setState("unknown");
    // Sayfa açıkken aynı sekmede yeni bir bağlantı açılırsa (yalnız #hash değişir).
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const isService = next.startsWith("/panel");
  const loginHref = isService ? "/panel/login" : `/bireysel/giris?next=${encodeURIComponent(next)}`;

  return (
    <AuthShell role={isService ? "servis" : "bireysel"}>
      {state === "loading" && <p role="status" style={{ color: colors.textMuted, margin: 0 }}>Kontrol ediliyor…</p>}
      {state === "ok" && (
        <div data-testid="confirm-ok">
          <h1 className="otoiz-auth2-title">E-postan doğrulandı</h1>
          <p className="otoiz-auth2-sub">Şimdi giriş yapıp kaldığın yerden devam edebilirsin.</p>
          <a href={loginHref} style={{ ...primaryButtonStyle(false), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>Giriş yap</a>
        </div>
      )}
      {(state === "error" || state === "unknown") && (
        <div data-testid="confirm-error">
          <h1 className="otoiz-auth2-title">
            {state === "error" ? "Bağlantı geçersiz veya süresi dolmuş" : "Doğrulama bağlantısı"}
          </h1>
          <p className="otoiz-auth2-sub" style={{ marginBottom: 14 }}>
            Hesabın daha önce doğrulandıysa doğrudan giriş yapabilirsin. Doğrulanmadıysa e-posta adresini yazıp yeni bağlantı iste.
          </p>
          <ResendConfirmation next={next} />
          <a href={loginHref} style={{ ...primaryButtonStyle(false), display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", marginTop: 12 }}>Giriş yap</a>
        </div>
      )}
    </AuthShell>
  );
}

export default function DogrulandiPage() {
  return (
    <Suspense fallback={<AuthShellLoading />}>
      <Inner />
    </Suspense>
  );
}
