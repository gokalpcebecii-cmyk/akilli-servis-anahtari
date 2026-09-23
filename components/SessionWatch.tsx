"use client";

// 2026-09-23: Oturum bekçisi. Sayfalar oturumu yalnız tarayıcıdaki yerel
// kayıttan (getSession) okuyor; oturum başka bir sekmede/cihazda kapatılmış
// ya da sunucuda geçersiz olmuşsa sayfa açık kalıyor ve ilk kayıt denemesi
// ham "unauthorized" hatasıyla düşüyordu. Bu bileşen sayfa açılışında ve
// sekmeye her dönüşte oturumu sunucuda doğrular; geçersizse yerel oturumu
// temizleyip doğru giriş sayfasına yönlendirir.
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

const PUBLIC_PREFIXES = ["/panel/login", "/panel/kayit", "/bireysel/giris", "/bireysel/kayit", "/bireysel/devir-kabul"];

export function loginPathFor(pathname: string | null): string | null {
  if (!pathname) return null;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (pathname.startsWith("/panel")) return "/panel/login";
  if (pathname.startsWith("/bireysel")) return "/bireysel/giris";
  return null; // ana sayfa, pasaport, yönetim (kendi girişi var) vb.
}

export default function SessionWatch() {
  const pathname = usePathname();

  useEffect(() => {
    const loginPath = loginPathFor(pathname);
    if (!loginPath) return;
    const supabase = createBrowserSupabase();
    let busy = false;

    async function check() {
      if (busy) return;
      busy = true;
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          window.location.replace(`${loginPath}?oturum=bitti`);
          return;
        }
        const { error } = await supabase.auth.getUser();
        const status = (error as any)?.status;
        if (error && (status === 401 || status === 403)) {
          await supabase.auth.signOut({ scope: "local" });
          window.location.replace(`${loginPath}?oturum=bitti`);
        }
      } catch {
        // ağ hatası: kullanıcıyı atma, bir sonraki kontrolde yeniden dene
      } finally {
        busy = false;
      }
    }

    check();
    const onVis = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", check);
    };
  }, [pathname]);

  return null;
}
