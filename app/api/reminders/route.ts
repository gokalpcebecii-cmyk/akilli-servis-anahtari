import { createServerSupabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
const { shouldSendReminder } = require("@/lib/logic");
const { sendSms } = require("@/lib/sms");
const { authorizeCronRequest } = require("@/lib/cronAuth");

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const auth = authorizeCronRequest(authHeader, process.env.CRON_SECRET);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const { data: vehicles, error } = await supabase
    .from("vehicles")
    .select("id, plate, current_km, next_service_km, next_service_date, tenant_id, customer_id, customers(phone, full_name), tenants(name, reminder_km_before, reminder_days_before)")
    .not("customer_id", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let dryRun = 0;
  const results: any[] = [];

  for (const v of vehicles ?? []) {
    const tenant = (v as any).tenants;
    const customer = (v as any).customers;
    if (!customer?.phone) continue;

    const due = shouldSendReminder({
      currentKm: v.current_km,
      nextServiceKm: v.next_service_km,
      nextServiceDateISO: v.next_service_date,
      todayISO: today,
      reminderKmBefore: tenant?.reminder_km_before ?? 500,
      reminderDaysBefore: tenant?.reminder_days_before ?? 14,
    });

    if (due) {
      const message = `Sayın ${customer.full_name || "müşterimiz"}, ${v.plate} plakalı aracınızın bakım zamanı yaklaşıyor. ${tenant?.name} sizi bekliyor.`;
      const result = await sendSms(customer.phone, message);
      // Kuru çalıştırma "gönderildi" sayılmaz; yanıtta plaka yerine araç id'si.
      results.push({ vehicle_id: v.id, sent: result.ok && !result.dryRun, dryRun: !!result.dryRun });
      if (result.ok && result.dryRun) dryRun++;
      else if (result.ok) sent++;
    }
  }

  return NextResponse.json({ checked: vehicles?.length ?? 0, sent, dryRun, results });
}
