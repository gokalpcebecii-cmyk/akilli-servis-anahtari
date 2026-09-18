import { createServerSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Kritik olaylar (araç oluşturma, sahiplik devri, QR atama/iptal) artık
// DB tetikleyicileri (log_vehicle_created, log_ownership_transfer,
// log_qr_key_assigned, log_qr_key_revoked) tarafından, istemciye güvenmeden
// otomatik olarak audit_log'a yazılıyor. Bu route yalnızca, aşağıdaki
// allowlist'te olan ve hedefin gerçekten çağıranın kendi tenant'ına ait
// olduğu sunucu tarafında doğrulanabilen, tamamlayıcı olaylar için var;
// istemcinin gönderdiği serbest metin action/target/detail'e güvenilmez.
const ALLOWED_ACTIONS: Record<string, { targetTable: string }> = {
  "ownership.transfer": { targetTable: "vehicles" },
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();

    const action = typeof body.action === "string" ? body.action : "";
    const allowed = ALLOWED_ACTIONS[action];
    if (!allowed || body.target_table !== allowed.targetTable || !body.target_id) {
      return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
    }

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

    if (!staff?.tenant_id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Hedefin gerçekten bu kullanıcının tenant'ına ait olduğunu DB'den
    // doğrula; istemcinin iddiasına güvenme.
    const { data: targetVehicle } = await supabase
      .from("vehicles")
      .select("id")
      .eq("id", body.target_id)
      .eq("tenant_id", staff.tenant_id)
      .maybeSingle();

    if (!targetVehicle) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    await supabase.from("audit_log").insert({
      tenant_id: staff.tenant_id,
      actor_staff_id: userData.user.id,
      action,
      target_table: body.target_table,
      target_id: body.target_id,
      detail: null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "audit_log_failed" }, { status: 500 });
  }
}
