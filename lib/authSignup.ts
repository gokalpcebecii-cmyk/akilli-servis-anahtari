// OTOİZ Faz 3.1 — kayıt / doğrulama e-postası için sunucu tarafı Auth istemcisi.
// Anon anahtarlı ve "implicit" akışlı: e-postadaki bağlantı Auth sunucusunda
// doğrulanır; kullanıcı bağlantıyı hangi tarayıcıda açarsa açsın hesap
// doğrulanır (PKCE'deki aynı-tarayıcı şartı yok).
import { createClient } from "@supabase/supabase-js";

export function appOriginFor(req: Request) {
  return (process.env.OTOIZ_APP_ORIGIN || "").trim().replace(/\/+$/, "") || new URL(req.url).origin;
}

export function authClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: "implicit" },
  });
}
