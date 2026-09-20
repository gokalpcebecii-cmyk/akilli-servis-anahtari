// PILOT FIX 03 — pilot süresince erişilemez kılınan özellikler için TEK,
// merkezi flag noktası (madde A7, bölüm F; ikinci düzeltme turu madde 3/4).
// Hiçbiri veri modelini/backend mantığını değiştirmez; yalnızca UX'te
// CTA/route erişimini kapatır. Kalıcı çözüm ayrı teknik görevler olarak
// planlanmalı (final raporda listelendi) — bu flag'ler o görevler
// tamamlanınca true'ya çevrilir.
//
// GÜVENLİK NOTU (ikinci düzeltme turu madde 3): bu flag'ler yalnızca
// SAYFA/route seviyesinde değil, aynı zamanda ilgili API route'larının
// (app/api/qr-uretim, app/api/ownership-transfer) İÇİNDE de kontrol
// edilir — doğrudan API çağrısıyla UI'yi atlamaya çalışan bir istek de
// aynı şekilde reddedilir (bkz. o route'lardaki kontroller).
export const PILOT_FLAGS = {
  // A7: geri alınamaz kişisel veri etkisine rağmen onay kutusu olmadan
  // erişilebilir olan servis self-service sahiplik devri. Kalıcı çözüm:
  // etki özeti + alıcı doğrulaması + yeniden kimlik doğrulama + audit.
  ownershipTransferSelfService: false,
  // F: sayfa 50 adet seçili açılıyor, üretim eylemi baştan aktif —
  // kazara toplu üretim riski. Kabul testleri geçene kadar kapalı.
  bulkQrGeneration: false,
  // İkinci düzeltme turu madde 4: kamera ile QR/anahtarlık tarama bu pilot
  // sürümde yok; yalnızca manuel URL/kısa-kod eşleştirme akışı çalışıyordu.
  // Güvenilir olmayan bir eşleştirme yolu açık bırakılmasın diye TÜM
  // eşleştirme ekranı (kamera dahil, ne zaman eklenirse) kapatılana kadar
  // kapalı.
  qrMatchingSelfService: false,
} as const;
