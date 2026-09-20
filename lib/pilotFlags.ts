// PILOT FIX 03 — pilot süresince erişilemez kılınan özellikler için TEK,
// merkezi flag noktası (madde A7, bölüm F). Hiçbiri veri modelini/backend
// mantığını değiştirmez; yalnızca UX'te CTA/route erişimini kapatır.
// Kalıcı çözüm ayrı teknik görevler olarak planlanmalı (final raporda
// listelendi) — bu flag'ler o görevler tamamlanınca true'ya çevrilir.
export const PILOT_FLAGS = {
  // A7: geri alınamaz kişisel veri etkisine rağmen onay kutusu olmadan
  // erişilebilir olan servis self-service sahiplik devri. Kalıcı çözüm:
  // etki özeti + alıcı doğrulaması + yeniden kimlik doğrulama + audit.
  ownershipTransferSelfService: false,
  // F: sayfa 50 adet seçili açılıyor, üretim eylemi baştan aktif —
  // kazara toplu üretim riski. Kabul testleri geçene kadar kapalı.
  bulkQrGeneration: false,
} as const;
