# OTOİZ Faz 3 — fiziksel ürün + self-aktivasyon

## Veri modeli (tek kaynak: `qr_keys`)

Her fiziksel ürün `qr_keys`'te tek satırdır (`product_id = qr_keys.id`). Yeni alanlar:

| Alan | Anlam |
|---|---|
| `serial_no` | `OTZ-000001` (sıra: `product_serial_seq`, benzersiz) |
| `code` | 26 karakter QR token'ı (değişmedi, CSPRNG) |
| `activation_code_hash` | tek kullanımlık aktivasyon kodunun bcrypt özeti; araca bağlanınca/iptalde silinir |
| `batch_id` | `product_batches.id` |
| `distribution_channel` | internet / servis / bayi / merkez / bireysel |
| `distributor_tenant_id` | servis kanalında dağıtan servis (sahiplik değil) |
| `status` | created / in_stock / distributed / activated / revoked / replaced / archived |
| `created_at`, `assigned_at` | oluşturma / aktivasyon tarihi |
| `vehicle_id`, `activated_by` | bağlı araç, aktive eden kullanıcı |
| `replaces_qr_key_id` | replacement: bu ürünün yerine geçtiği eski anahtarlık |

`status`, `trg_qr_key_status` tetikleyicisiyle `revoked_at` / `vehicle_id`'den türetilir ve
`qr_keys_status_consistent` kısıtıyla zorunludur; mevcut akışlar status'u bilmeden doğru durumu üretir.

## Akış

QR → `go.<alan-adı>/<token>` → resolver (değişmedi) → `/p/<token>` → "Anahtarlığı etkinleştir"
→ `/aktivasyon?t=<token>` → giriş/kayıt → kod → araç seç/ekle → `activate_product()` → tamam.
QR okutulamazsa `/aktivasyon` seri no + kodla çalışır.

## Güvenlik

- Aktivasyon kodu 12 karakter (≈59,5 bit), yalnız sunucuda CSPRNG; düz metin yalnız parti üretiminde bir kez döner.
- Ürün başına 5 hatada 30 dk kilit; kullanıcı başına saatte 10 hata.
- `activate_product` e-posta doğrulaması, servis hesabı yasağı, araç sahipliği ve araçta tek aktif QR kontrolü yapar.
- `product_batches`, `product_activation_attempts` istemci rollerine kapalı; parti fonksiyonları yalnız service_role.

## Yönetim

Yönetim › Ürünler: 10/20/40/100/200/özel adet parti, stoğa al, dağıt (kanal, servis), arşivle, yeni kod ver,
paketleme/baskı/arşiv CSV, `/yonetim/yazdir?batch_id=` QR baskı sayfası (QR altında seri no).
QR Kodları sekmesindeki araca atama yalnız destek/kurtarma içindir.
