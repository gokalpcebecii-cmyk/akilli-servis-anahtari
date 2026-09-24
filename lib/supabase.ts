import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// 2026-09-24: Next.js 14, sunucu tarafındaki fetch GET yanıtlarını varsayılan
// olarak önbelleğe alabiliyor (Data Cache). Yönetim paneli genel bakışı ve
// hatırlatma CRON'u bayat veri döndürüyordu (yeni üretilen QR'lar "0"
// görünüyordu). Sunucu tarafı Supabase istemcileri artık hiçbir isteği
// önbelleğe almaz.
const noStoreFetch: typeof fetch = (input: any, init?: any) => fetch(input, { ...(init || {}), cache: "no-store" });

export function createServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, global: { fetch: noStoreFetch } }
  );
}

// Servis rolü anahtarı gerektirmeyen, anonim/herkese açık sunucu tarafı
// okumalar için (ör. /p/[code] pasaportu). Bu istemci RLS'ye tabidir;
// yalnızca anon rolüne açıkça izin verilen policy/fonksiyonlara erişebilir.
export function createAnonServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false }, global: { fetch: noStoreFetch } }
  );
}
