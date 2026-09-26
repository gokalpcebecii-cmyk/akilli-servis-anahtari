# OTOİZ — Kalıcı QR resolver (Aşama 1)

## Kalıcı sözleşme (fiziksel baskıdan sonra DEĞİŞMEZ)

- QR içeriği yalnız: `https://go.<final-domain>/<token>`
- `<token>`: 26 karakter, alfabe `abcdefghjkmnpqrstuvwxyz23456789` (≈128,8 bit, CSPRNG, `lib/qrToken.js`).
- Token araç kimliği değildir; `vehicle_id` ana kimliktir. Token iptal/yenilenebilir.
- Resolver büyük/küçük harf farkını ve sondaki `/` işaretini tolere eder.
- Yönlendirmeler her zaman **307** + `Cache-Control: no-store`. 301/308 kullanılmaz.

## Akış

```
Fiziksel QR → go.<domain>/<token>
  → next.config.js host rewrite (yalnız go-host) → /r/<token>
  → app/r/[token]/route.ts (anon istemci)
  → token normalize + format kontrolü (format dışı → DB'ye gitmeden 404)
  → resolve_qr_token RPC (yalnız durum döner)
      not_found  → 404 "Geçersiz OTOİZ kodu"
      revoked    → 410 "Bu OTOİZ anahtarı artık aktif değil."
      unassigned → 307 <OTOIZ_APP_ORIGIN>/p/<token>   (Aşama 1; aktivasyon sonraki aşamada)
      active     → 307 <OTOIZ_APP_ORIGIN>/p/<token>   (Aşama 1; rol bazlı yönlendirme sonraki aşamada)
      RPC hatası → 503
go-host'ta başka her yol → 404; go-host kökü → 307 ana site.
```

## Ortam değişkenleri

| Değişken | Production | Staging |
|---|---|---|
| `NEXT_PUBLIC_QR_BASE_URL` | `https://go.<domain>` (path yok, vercel.app değil) | Ör. `https://<staging>.vercel.app/r` |
| `OTOIZ_APP_ORIGIN` | `https://<domain>` | `https://<staging>.vercel.app` |

**QR kilidi:** `NEXT_PUBLIC_QR_BASE_URL` tanımlı değilse uygulama normal build/deploy olur (QR ile ilgisiz acil düzeltmeler çıkabilir), ancak:
- `/api/admin/qr` `generate` ve `/api/qr-uretim` → **423** `qr_issuance_locked` (QR partisi üretilemez),
- hiçbir ekran QR görseli üretmez (`printableQrUrl` → null): toplu baskı, QR listesi/indirme, araç ekranı.

Tanımlıysa değer sıkı doğrulanır; yanlış değerle (http, go. olmayan, path'li, vercel.app) production build başlamaz ve `OTOIZ_APP_ORIGIN` zorunludur (`lib/envCheck.js`).

## Veritabanı (migration `20260926094725_qr_resolver_foundation`)

- `resolve_qr_token(text)`: SECURITY DEFINER, `search_path=''`, anon/authenticated EXECUTE; yalnız durum döndürür.
- `qr_keys_active_code_format`: iptal edilmemiş kod 26 karakter/alfabe olmalı. (Production'da VALIDATE edilir; staging'de eski test kodları nedeniyle NOT VALID.)
- `qr_keys_vehicle_id_fkey`: `ON DELETE RESTRICT` (QR geçmişi olan araç silinemez; token boşa düşüp başka araca bağlanamaz).

Geri dönüş (roll-forward): `drop function public.resolve_qr_token(text)`; `drop constraint qr_keys_active_code_format`; FK'yi `on delete set null` ile yeniden ekle. Uygulama tarafı: env değişkenleri kaldırılırsa eski `/p/` davranışı geri gelir.

## Production geçiş kontrol listesi (ayrı onayla)

1. Final domain satın alınır (şirket hesabı, otomatik yenileme açık).
2. Vercel production projesine `<domain>` ve `go.<domain>` eklenir; DNS kayıtları girilir; SSL doğrulanır.
3. Supabase Auth → Site URL ve Redirect URLs'e `https://<domain>` eklenir (vercel.app adresi geçiş süresince kalır).
4. Vercel production env: `NEXT_PUBLIC_QR_BASE_URL=https://go.<domain>`, `OTOIZ_APP_ORIGIN=https://<domain>`.
5. Production migration (`qr_resolver_foundation`) — yedek sonrası.
6. PR merge → production deploy (env kapısı yeni kuralları uygular).
7. Canlı smoke: 4 durum, büyük harf, sondaki `/`, go-host'ta başka yol 404, eski `/p/<kod>` linkleri çalışıyor.
8. Fiziksel QR örneği basılır, iOS + Android'de okutulur. Ancak bundan sonra dağıtım amaçlı baskı yapılır.
