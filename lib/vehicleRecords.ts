// OTOİZ P1 — araç bakım geçmişi sayfalı okuma (en yeni önce, 50'lik).
// Toplam kayıt sayısı ayrıca döner; liste hiçbir zaman sessizce kesilmez.
export const RECORD_PAGE = 50;

export async function fetchVehicleRecords(supabase: any, vehicleId: string, offset = 0) {
  const { data, count, error } = await supabase
    .from("maintenance_records")
    .select("*", { count: "exact" })
    .eq("vehicle_id", vehicleId)
    .order("service_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + RECORD_PAGE - 1);
  return { rows: (data ?? []) as any[], count: (count ?? null) as number | null, error };
}
