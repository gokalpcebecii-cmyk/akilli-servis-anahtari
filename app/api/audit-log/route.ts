import { createServerSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabase = createServerSupabase();
    const { data: staff } = await supabase
      .from("staff_users")
      .select("tenant_id")
      .eq("id", userData.user.id)
      .single();

    await supabase.from("audit_log").insert({
      tenant_id: staff?.tenant_id,
      actor_staff_id: userData.user.id,
      action: body.action,
      target_table: body.target_table,
      target_id: body.target_id,
      detail: body.detail ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "audit_log_failed" }, { status: 500 });
  }
}
