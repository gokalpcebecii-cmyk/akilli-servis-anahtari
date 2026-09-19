// Kullanımdan kaldırıldı (deprecated).
//
// Bu route eskiden vehicle_id'yi DOĞRUDAN public URL kimliği olarak
// kullanıyor, service role ile tüm araç/tenant/bakım verisini okuyup
// gösteriyordu. Bu iki nedenle güvenli değildi:
//   1) vehicle_id kalıcıdır ve hiçbir zaman iptal edilemez — "QR/NFC araç
//      kimliği değildir, iptal/değiştirilebilir erişim anahtarıdır" kuralını
//      ihlal ediyordu.
//   2) Aracın DB birincil anahtarı (UUID) doğrudan public bir erişim
//      anahtarı olarak kullanılıyordu.
//
// Olası eski basılı/kaydedilmiş bağlantılar hâlâ bu adrese gelebileceği
// için route tamamen silinmedi; hiçbir veritabanı sorgusu yapmadan
// (vehicle_id'nin var olup olmadığını bile sızdırmadan), vehicle_id'den
// aktif QR koduna dönüşüm yapmadan (bu, kendi başına bir "oracle" olurdu)
// yalnızca sabit bir "bu bağlantı artık geçerli değil" ekranı gösterir.
// Güncel ve güvenli genel erişim yalnızca /p/[code] + iptal edilebilir
// qr_keys üzerinden sağlanır; bu route o modele hiçbir şekilde dokunmaz.

export const dynamic = "force-static";

export default function DeprecatedVehicleLinkPage() {
  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
      <h1 style={{ fontSize: 20 }}>Bu Bağlantı Artık Geçerli Değil</h1>
      <p style={{ color: "#666", lineHeight: 1.6 }}>
        Aracınızın dijital servis pasaportuna erişmek için lütfen anahtarlığınızdaki/NFC etiketinizdeki güncel
        QR kodunu okutun. Elinizdeki kod artık çalışmıyorsa, yetkili servisinizden yeni bir QR/NFC anahtarlığı
        talep edebilirsiniz.
      </p>
    </main>
  );
}
