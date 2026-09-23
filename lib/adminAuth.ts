// OTOİZ platform yöneticisi (proje sahibi) yetki kontrolü — YALNIZ sunucu
// tarafında (app/api/admin/*) kullanılır.
//
// Kural: çağıranın kimliği kendi JWT'si ile doğrulanır (anon key +
// Authorization header, RLS'ye tabi istemci), ardından service_role ile
// public.platform_admins tablosunda kaydı olup olmadığına bakılır. Bu tablo
// anon/authenticated rollerine TAMAMEN kapalıdır (bkz. migration
// platform_admin_and_qr_reservation) — bir kullanıcı kendini yönetici
// yapamaz, yönetici listesini okuyamaz.
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export type AdminContext = {
  userId: string;
  email: string | null;
  db: ReturnType<typeof createServerSupabase>;
};

export async function requireAdmin(req: NextRequest): Promise<AdminContext | NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
  );
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createServerSupabase();
  const { data: admin } = await db
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return { userId: user.id, email: user.email ?? null, db };
}

export function isAdminContext(x: AdminContext | NextResponse): x is AdminContext {
  return (x as AdminContext).userId !== undefined;
}
