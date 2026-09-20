import { createServerSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { PILOT_FLAGS } from "@/lib/pilotFlags";
const { prepareOwnershipTransfer } = require("@/lib/logic");

// İkinci düzeltme turu (madde 3): sahiplik devri artık tarayıcının kendi
// çok adımlı Supabase çağrılarıyla değil, bu servis-rolü route'uyla
// yapılıyor — pilot bayrağı (PILOT_FLAGS.ownershipTransferSelfService)
// burada, herhangi bir yazma çalışmadan EN BAŞTA kontrol ediliyor. Böylece
// /panel/araclar/[id]/devret ekranı atlanıp doğrudan bu route'a istek
// gönderilse bile pilot süresince sıfır veri yan etkisiyle 403 döner.
// Hedef aracın GERÇEKTEN çağıranın kendi tenant'ına ait olduğu (qr-eslestir
// route'undaki desenle aynı şekilde) burada, servis-rolü sorgusunda
// AÇIKÇA doğrulanıyor — RLS'ye güvenilmiyor çünkü bu istemci RLS'yi
// bypass ediyor. Veri modeli/mantık DEĞİŞMEDİ, yalnızca yazma yolu
// taşındı.
export async function POST(req: NextRequest) {
  try {
    if (!PILOT_FLAGS.ownershipTransferSelfService) {
      return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
    }

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

    if (!body.confirm_erase) {
      return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
    }
    if (!body.vehicle_id) {
      return NextResponse.json({ error: "vehicle_id_required" }, { status: 400 });
    }

    const supabase = createServerSupabase();

    const { data: staff } = await supabase.from("staff_users").select("tenant_id").eq("id", userData.user.id).maybeSingle();
    if (!staff?.tenant_id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Hedef aracın gerçekten bu kullanıcının tenant'ına ait olduğu burada
    // doğrulanıyor — istemcinin gönderdiği vehicle_id'ye körü körüne güvenilmiyor.
    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("id, customer_id, current_km, owner_user_id, tenant_id")
      .eq("id", body.vehicle_id)
      .eq("tenant_id", staff.tenant_id)
      .maybeSingle();
    if (!vehicle) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    let previousCustomer = null;
    if (vehicle.customer_id) {
      const { data: c } = await supabase.from("customers").select("*").eq("id", vehicle.customer_id).maybeSingle();
      previousCustomer = c;
    }

    const transferDate = new Date().toISOString().slice(0, 10);
    const { anonymizedSnapshot, fieldsToErase } = prepareOwnershipTransfer(previousCustomer, transferDate);

    const newOwner = {
      full_name: typeof body.new_owner?.full_name === "string" ? body.new_owner.full_name : "",
      phone: typeof body.new_owner?.phone === "string" ? body.new_owner.phone : "",
      email: typeof body.new_owner?.email === "string" ? body.new_owner.email : "",
    };

    const { data: createdCustomer, error: customerError } = await supabase
      .from("customers")
      .insert({ tenant_id: staff.tenant_id, ...newOwner })
      .select()
      .single();
    if (customerError) {
      return NextResponse.json({ error: customerError.message }, { status: 400 });
    }

    const kmAtTransfer = body.km_at_transfer ? Number(body.km_at_transfer) : vehicle.current_km;

    await supabase.from("ownership_transfers").insert({
      vehicle_id: vehicle.id,
      tenant_id: staff.tenant_id,
      previous_customer_snapshot: anonymizedSnapshot,
      previous_customer_data_erased: fieldsToErase.length > 0,
      new_customer_id: createdCustomer.id,
      km_at_transfer: kmAtTransfer,
      performed_by: userData.user.id,
      previous_owner_user_id: vehicle.owner_user_id ?? null,
      new_owner_user_id: null,
    });

    await supabase.from("vehicles").update({ customer_id: createdCustomer.id, owner_user_id: null }).eq("id", vehicle.id);

    if (previousCustomer && fieldsToErase.length > 0) {
      await supabase
        .from("customers")
        .update({ full_name: "Devredilmiş Kayıt", phone: null, email: null })
        .eq("id", previousCustomer.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}
