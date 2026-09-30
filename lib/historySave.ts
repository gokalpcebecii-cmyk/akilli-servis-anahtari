// OTOİZ Nihai UX — bireysel geçmiş kayıtlarını yazar (araç sahibi, RLS).
// Sıra: 1) tüm geçmiş kayıtları TEK insert (hepsi ya da hiçbiri; aynı istek
// kimlikleriyle tekrar gönderim ikinci kayıt üretmez) → 2) her bakım kaleminin
// son işlem km/tarihi → 3) sonraki bakım planı, en son periyodik geçmiş
// kaydının tarih ve km'sinden (OTOİZ'e kayıt tarihinden değil).
const { historyDescription, itemUpdatesFromHistory, planFromHistory } = require("@/lib/history");
const { DEFAULT_INTERVALS } = require("@/lib/maintenanceItems");

export type HistoryEntry = { date: string; km: string; items: string[]; otherOn: boolean; otherText: string; note: string };

export type HistoryPlan = { nextServiceKm: number | null; nextServiceDate: string | null; fromDate: string; fromKm: number };
export type HistorySaveResult = { ok: boolean; message?: string; plan?: HistoryPlan | null };

export function newRequestId(): string {
  return typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : `${Date.now().toString(16).padStart(8, "0").slice(-8)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;
}

export async function saveHistoryEntries({
  supabase,
  vehicleId,
  userId,
  entries,
  requestIds,
}: {
  supabase: any;
  vehicleId: string;
  userId: string;
  entries: HistoryEntry[];
  requestIds: string[];
}): Promise<HistorySaveResult> {
  // Geçmiş kaydı yazılmadan önce araçtaki en yeni kayıt tarihi (geçmiş kaydı,
  // daha yeni bir servis kaydının planını ezmesin).
  const [{ data: latestRec, error: latestErr }, { data: existingItems, error: itemsErr }] = await Promise.all([
    supabase.from("maintenance_records").select("service_date").eq("vehicle_id", vehicleId).order("service_date", { ascending: false }).limit(1),
    supabase.from("maintenance_items").select("*").eq("vehicle_id", vehicleId),
  ]);
  if (latestErr || itemsErr) return { ok: false, message: "Bağlantı hatası. Hiçbir şey kaydedilmedi; tekrar deneyin." };
  const alreadyIds = new Set<string>();
  const existingLatestDate = Array.isArray(latestRec) && latestRec[0] ? latestRec[0].service_date : null;

  const rows = entries.map((e, i) => ({
    vehicle_id: vehicleId,
    tenant_id: null,
    service_date: e.date,
    km_at_service: e.km === "" ? null : Number(e.km),
    description: historyDescription(e),
    created_by: userId,
    client_request_id: requestIds[i],
  }));
  const { error: insErr } = await supabase.from("maintenance_records").insert(rows);
  if (insErr) {
    // 23505: aynı istek kimliği zaten yazılmış (bağlantı kopması sonrası
    // tekrar deneme) — kayıtlar zaten var, kalan adımlara devam edilir.
    if (String((insErr as any).code) !== "23505") {
      return { ok: false, message: "Geçmiş kaydedilemedi; hiçbir kayıt eklenmedi. Tekrar deneyin." };
    }
    requestIds.forEach((id) => alreadyIds.add(id));
  }

  const intervals = DEFAULT_INTERVALS;
  const updates = itemUpdatesFromHistory(entries, existingItems ?? [], intervals);
  if (updates.length > 0) {
    const { error: upErr } = await supabase
      .from("maintenance_items")
      .upsert(updates.map((u: any) => ({ vehicle_id: vehicleId, ...u })), { onConflict: "vehicle_id,item_key" });
    if (upErr) return { ok: false, message: "Kayıtlar eklendi ancak bakım takibi güncellenemedi. Sayfayı yenileyip tekrar deneyin." };
  }

  // Aynı tekrar denemesinde kendi eklediğimiz kayıt "daha yeni kayıt" sayılmaz.
  const plan = planFromHistory(entries, { existingLatestDate: alreadyIds.size > 0 ? null : existingLatestDate, existingItems: existingItems ?? [], intervals });
  if (plan) {
    const { error: vErr } = await supabase
      .from("vehicles")
      .update({ next_service_km: plan.nextServiceKm, next_service_date: plan.nextServiceDate, updated_at: new Date().toISOString() })
      .eq("id", vehicleId);
    if (vErr) return { ok: false, message: "Kayıtlar eklendi ancak sonraki bakım güncellenemedi. Sayfayı yenileyip tekrar deneyin." };
  }
  return { ok: true, plan };
}
