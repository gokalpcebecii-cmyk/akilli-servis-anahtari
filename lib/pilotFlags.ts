// PILOT FIX 03 — pilot süresince erişilemez kılınan özellikler için TEK,
// merkezi flag noktası (madde A7, bölüm F; ikinci düzeltme turu madde 3/4).
// Hiçbiri veri modelini/backend mantığını değiştirmez; yalnızca UX'te
// CTA/route erişimini kapatır. Kalıcı çözüm ayrı teknik görevler olarak
// planlanmalı (final raporda listelendi) — bu flag'ler o görevler
// tamamlanınca true'ya çevrilir.
//
// GÜVENLİK NOTU (04A-S güvenlik sertleştirme turu — STAGING'DE doğrulandı,
// bkz. supabase/migrations/20260922174352_qr_pilot_lockdown.sql ve
// 20260922174458_security_definer_hardening.sql): önceki not burada
// ownershipTransferSelfService ve qrMatchingSelfService'in yalnızca UI
// seviyesinde kapalı olduğunu, altlarındaki RPC/RLS'in doğrudan Supabase
// çağrısıyla bypass edilebildiğini söylüyordu. Bu artık staging'de DOĞRU
// DEĞİL: qr_keys'teki havuz-claim'e izin veren staff UPDATE politikası
// kaldırıldı ve qr_keys INSERT/UPDATE/DELETE anon+authenticated'den tümüyle
// revoke edildi; initiate/accept/cancel/list_my_pending_outgoing_transfers
// ve preview_ownership_transfer RPC'lerinin EXECUTE yetkisi authenticated
// (ve preview için anon) rollerinden alındı, yalnızca service_role kaldı.
// Production'da bu değişiklikler HENÜZ uygulanmadı (SECURITY_FIX_04_PROPOSAL.md,
// öneri) — bu flag'ler yine de UX'i kapalı tutmaya devam ediyor.
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
  // 04A-S turu bulgusu: bireysel araç detay sayfası (loadQr/handleRevokeQr/
  // handleIssueNewQr), qr_keys'e DOĞRUDAN istemci tarafından (browser,
  // authenticated rolüyle) insert/update yapıyordu — diğer QR akışlarının
  // aksine hiçbir PILOT_FLAGS kapısı arkasında değildi. "QR/NFC pilot
  // kapsamı güvenlik kabulüne kadar kapalı kalacak" kuralı gereği, aynı
  // desen kullanılarak kapatıldı. qr_keys üzerindeki client INSERT/UPDATE
  // zaten staging'de RLS+grant seviyesinde kapatıldı (yukarı bakınız); bu
  // flag yalnızca UX'i buna uygun hale getirir (kırık istek yerine temiz
  // "kullanılamıyor" mesajı).
  qrSelfIssuance: false,
} as const;
