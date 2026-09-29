"use strict";

// DÜZELTME 01 — Yönetim > Araçlar toplam sayacı metinleri (saf fonksiyon, test edilebilir).
// Sayım mantığı değişmez: toplamlar /api/admin/araclar'ın ilk sayfada döndürdüğü
// `total` alanından gelir (arama yokken tüm araçlar, aramada eşleşen araçlar).

function fmt(n) {
  return Number(n).toLocaleString("tr-TR");
}

// allTotal: aramasız ilk sayfadan gelen toplam (null = bilinmiyor)
// matchTotal: son yanıtın toplamı (arama varsa eşleşen sayısı)
// shown: ekranda listelenen araç sayısı; query: kullanıcının yazdığı arama; loading: yanıt bekleniyor
function vehicleCountView({ allTotal, matchTotal, shown, query, loading }) {
  const searching = typeof query === "string" && query.trim() !== "";
  const known = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0;
  const headline = known(allTotal) ? fmt(allTotal) : loading ? "…" : "—";
  let detail;
  if (loading) detail = searching ? "Aranıyor…" : "Yükleniyor…";
  else if (searching) detail = known(matchTotal) ? `“${query.trim()}” için ${fmt(matchTotal)} sonuç · ${fmt(shown)} gösteriliyor` : `${fmt(shown)} sonuç gösteriliyor`;
  else if (known(allTotal)) detail = `en yeni önce · ${fmt(shown)} gösteriliyor`;
  else detail = "Toplam sayı alınamadı, sayfayı yenileyin";
  return { headline, detail, searching };
}

module.exports = { vehicleCountView };
