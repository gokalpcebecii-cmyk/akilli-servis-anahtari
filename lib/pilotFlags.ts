// PILOT FIX 03 — pilot süresince erişilemez kılınan özellikler için TEK,
// merkezi flag noktası (madde A7, bölüm F; ikinci düzeltme turu madde 3/4).
// Hiçbiri veri modelini/backend mantığını değiştirmez; yalnızca UX'te
// CTA/route erişimini kapatır. Kalıcı çözüm ayrı teknik görevler olarak
// planlanmalı (final raporda listelendi) — bu flag'ler o görevler
// tamamlanınca true'ya çevrilir.
//
// GÜVENLİK NOTU (üçüncü düzeltme turu madde 6 — ikinci turun aşırı iddialı
// notu düzeltildi): bulkQrGeneration, app/api/qr-uretim İÇİNDE de kontrol
// edilir VE bu gerçek bir DB-seviyeli kapanıştır (qr_keys'te vehicle_id=
// null satır ekleyebilecek hiçbir RLS politikası yok — salt-okunur
// incelemeyle doğrulandı). AMA ownershipTransferSelfService ve
// qrMatchingSelfService farklıdır: bunlar YALNIZCA UI/uygulama akışını
// kapatır. Altlarındaki RPC/RLS (initiate_ownership_transfer vb. SECURITY
// DEFINER + authenticated'e EXECUTE yetkisi; qr_keys UPDATE'i izin veren
// staff RLS politikası) doğrulanmış bir kullanıcının doğrudan Supabase
// çağrısıyla bu bayrakları BYPASS ETMESİNE halihazırda izin veriyor. Gerçek
// DB-seviyeli kapanış için bkz. SECURITY_FIX_04_PROPOSAL.md (öneri,
// uygulanmadı).
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
