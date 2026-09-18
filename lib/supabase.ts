import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function createServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Servis rolü anahtarı gerektirmeyen, anonim/herkese açık sunucu tarafı
// okumalar için (ör. /p/[code] pasaportu). Bu istemci RLS'ye tabidir;
// yalnızca anon rolüne açıkça izin verilen policy/fonksiyonlara erişebilir.
export function createAnonServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
