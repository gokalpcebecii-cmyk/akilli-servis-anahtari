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

// OTOİZ Aşama E — "Araç Durumu" için son muayene ve son detailing kaydı.
// Yalnız 2 küçük sorgu (limit 1); kategori metin eşleşmesi lib/vehicleStatus
// recordCategory ile aynı anahtar kelimeler. RLS aynen geçerli.
const DETAILING_OR = ["seramik", "detailing", "detay temizli", "pasta", "cila", "kaplama", "ppf", "boya koruma", "iç temizlik", "koltuk temizli"]
  .map((w) => `description.ilike.*${w}*`)
  .join(",");

export async function fetchStatusRecords(supabase: any, vehicleId: string) {
  const base = () =>
    supabase
      .from("maintenance_records")
      .select("id, service_date, description")
      .eq("vehicle_id", vehicleId)
      .order("service_date", { ascending: false })
      .limit(1);
  const [mu, de] = await Promise.all([base().ilike("description", "%muayene%"), base().or(DETAILING_OR)]);
  const first = (r: any) => (Array.isArray(r?.data) && r.data.length ? r.data[0] : null);
  return { lastMuayene: first(mu), lastDetailing: first(de) };
}
