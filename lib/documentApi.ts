// OTOİZ — belge API'si için kullanıcı JWT'li (RLS altında) Supabase istemcisi.
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const noStoreFetch: typeof fetch = (input: any, init?: any) => fetch(input, { ...(init || {}), cache: "no-store" });

// Bearer jetonu doğrulanır; dönen istemci her sorguda kullanıcının kendi
// yetkisiyle (RLS) çalışır. Servis rolü anahtarı burada KULLANILMAZ.
export async function userClientFrom(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader }, fetch: noStoreFetch },
    auth: { persistSession: false },
  });
  const { data } = await client.auth.getUser();
  if (!data?.user) return null;
  return { client, user: data.user };
}
