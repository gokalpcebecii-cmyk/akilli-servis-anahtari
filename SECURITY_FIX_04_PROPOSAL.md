# SECURITY FIX 04 — Öneri Planı (uygulanmadı)

Bu belge, üçüncü güvenlik hazırlık turunda tespit edilen ve **DB/RLS/migration
gerektirdiği için uygulanmayan** üç konuyu kapsar. Hiçbiri bu turda
çalıştırılmadı — hepsi öneri düzeyindedir ve ayrı bir onay/uygulama turu
gerektirir. Bulgular, `sbfsiwqxbsojcxdutnem` projesinde **salt-okunur**
SQL sorgularıyla (yalnızca `SELECT ... FROM pg_policies/pg_proc/pg_indexes`)
doğrulandı; hiçbir satır değiştirilmedi, hiçbir DDL çalıştırılmadı.

---

## 1) Normalize edilmiş plaka için eşzamanlı mükerrer kayıt koruması

### Sorun

`/api/vehicles` (ve `lib/vehicleWrite.js`) mükerrer plaka kontrolünü
select-then-insert deseniyle yapıyor: önce aynı kapsamda (tenant/owner)
aynı kanonik plakayı arar, yoksa insert eder. Bu, **ardışık** çift
gönderimde (gerçek çift tık/Enter+tık, aralarında ağ/işlem gecikmesi olan
istekler) pratikte çalışır ve testlerle kanıtlanmıştır — ama iki isteğin
**tam eşzamanlı** (aynı mikrosaniyede, her ikisi de select adımını
diğerinin insert'i tamamlanmadan geçen) sunucuya ulaşması, DB seviyesinde
hiçbir şeyin engellemediği klasik bir TOCTOU (time-of-check-time-of-use)
yarış durumudur. Mevcut `idx_vehicles_plate` indeksi **UNIQUE değildir**.

### Önerilen çözüm

`vehicles.plate` sütunu her zaman `normalizePlate()` ile normalize
edilmiş halde yazılıyor (bkz. `lib/logic.js`, tüm yazma yolları). Bu
sayede ham sütun üzerinde, kanonik-form karşılaştırması için ek bir
fonksiyonel indekse gerek yok — ancak bu, **gelecekte eklenecek her yeni
yazma yolunun da normalize edilmiş değer yazmaya devam etmesine bağlıdır**
(bu varsayım açıkça not edilmeli).

İki ayrı **kısmi (partial) UNIQUE indeks** — `idx_vehicles_vin`'in zaten
kullandığı desenin aynısı:

```sql
-- YALNIZCA ÖNERİ — bu turda ÇALIŞTIRILMADI.

-- Servis-kapsamlı: aynı tenant içinde aynı plaka iki kez olamaz.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_vehicles_tenant_plate
  ON public.vehicles (tenant_id, plate)
  WHERE tenant_id IS NOT NULL;

-- Bireysel-kapsamlı: aynı owner_user_id için aynı plaka iki kez olamaz.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_vehicles_owner_plate
  ON public.vehicles (owner_user_id, plate)
  WHERE owner_user_id IS NOT NULL;
```

`CREATE INDEX CONCURRENTLY` seçildi çünkü `vehicles` tablosu üretim
trafiği alıyor olabilir — `CONCURRENTLY` tabloyu insert/update için
kilitlemeden indeks oluşturur (yalnızca biraz daha yavaştır ve bir
transaction bloğu içinde çalıştırılamaz, ayrı olarak çalıştırılmalı).

Uygulama tarafında (`lib/vehicleWrite.js`) bu durumda Postgres'in
`23505 unique_violation` hata kodunu yakalayıp 409 + mevcut
`"Bu plakayla zaten bir araç kayıtlı."` mesajına çevirecek bir `catch`
eklenmesi gerekir (küçük, düşük riskli bir uygulama-kodu değişikliği —
bu SQL'lerle BİRLİKTE, aynı PR'da yapılmalı).

### Migration öncesi veri denetimi (uygulanmadan önce ZORUNLU)

Aşağıdaki salt-okunur sorgu, indeks oluşturulmadan ÖNCE mevcut veride
ihlal olup olmadığını kontrol eder — bir ihlal varsa `CREATE UNIQUE INDEX`
başarısız olur ve önce o kayıtların elle çözülmesi gerekir:

```sql
-- Denetim — salt okunur, migration'dan önce çalıştırılmalı.
SELECT tenant_id, plate, count(*), array_agg(id) AS vehicle_ids
FROM public.vehicles
WHERE tenant_id IS NOT NULL
GROUP BY tenant_id, plate
HAVING count(*) > 1;

SELECT owner_user_id, plate, count(*), array_agg(id) AS vehicle_ids
FROM public.vehicles
WHERE owner_user_id IS NOT NULL
GROUP BY owner_user_id, plate
HAVING count(*) > 1;
```

Bu turda bu denetim sorgusu **çalıştırılmadı** (SQL çalıştırma bu görevde
yasaktı) — uygulama öncesi mutlaka çalıştırılmalı.

### Rollback planı

```sql
DROP INDEX CONCURRENTLY IF EXISTS uniq_vehicles_tenant_plate;
DROP INDEX CONCURRENTLY IF EXISTS uniq_vehicles_owner_plate;
```

İndeks kaldırma geri dönüşü kolaydır (veri kaybı yok, yalnızca kısıt
kaldırılır). Uygulama kodundaki `23505` yakalama bloğu geri alınmasa da
zararsızdır (indeks yoksa o hata kodu hiç oluşmaz).

### Risk değerlendirmesi

- **Düşük risk**: `CONCURRENTLY` ile kilitlenme riski yok; kısmi indeks
  olduğu için NULL tenant_id/owner_user_id kayıtlarını etkilemez.
- **Ön koşul riski**: mevcut veride ihlal varsa migration başarısız olur
  — bu yüzden denetim sorgusu ZORUNLU ön adım.
- **Uygulama riski**: `lib/vehicleWrite.js`'in `23505` yakalama bloğu
  eksik bırakılırsa, kullanıcı 409 yerine ham bir 500/Postgres hatası
  görür — bu yüzden SQL ve kod değişikliği BİRLİKTE yapılmalı.

---

## 2) Sahiplik devri RPC'lerinin EXECUTE yetkisi

### Sorun (bu turda doğrulandı)

```sql
SELECT p.proname, p.prosecdef, array_agg(r.rolname)
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname='public'
  AND p.proname IN ('initiate_ownership_transfer','accept_ownership_transfer',
                     'cancel_ownership_transfer','list_my_pending_outgoing_transfers')
  AND has_function_privilege(r.oid, p.oid, 'EXECUTE')
GROUP BY p.proname, p.prosecdef;
```

Sonuç: **dört fonksiyonun dördü de `SECURITY DEFINER` ve `EXECUTE`
yetkisi doğrudan `authenticated` rolüne verilmiş.** Bu, Next.js
tarafındaki `PILOT_FLAGS.ownershipTransferSelfService = false`
kontrolünün **DB seviyesinde hiçbir karşılığı olmadığı** anlamına gelir
— herhangi bir doğrulanmış kullanıcı, kendi geçerli oturum token'ıyla
`supabase.rpc('initiate_ownership_transfer', {...})` çağrısını
**doğrudan**, bizim Next.js uygulamamızı hiç kullanmadan yapabilir.

Aynı şekilde, `ownership_transfers`/`customers`/`vehicles` üzerindeki RLS
politikaları (`staff_own_tenant_transfers`, `owner_manage_own_vehicle_
transfers`, `staff_modify_own_tenant_vehicles`) zaten kapsamlı
(tenant/owner) yazmaya izin veriyor — yani servis tarafındaki devir akışı
da aynı şekilde RLS üzerinden doğrudan erişilebilir durumda.

**Sonuç**: `PILOT_FLAGS.ownershipTransferSelfService` şu an yalnızca bir
**UX kontrolü**dür (normal uygulama akışını kapatır), bir **güvenlik
sınırı değildir**. Bu üçüncü turda, bu gerçeği gizleyen/yanlış izlenim
veren iki API route'u (`/api/ownership-transfer`,
`/api/ownership-transfer-initiate`) kaldırıldı — onlar da aynı RLS/RPC
yetkileriyle sınırlıydı, ekstra bir kapanış sağlamıyorlardı, yalnızca
gereksiz saldırı yüzeyiydi.

### Önerilen çözüm (iki seçenek — biri seçilmeli)

**Seçenek A — RPC EXECUTE yetkisini kısıtla (basit, pilot için yeterli):**

```sql
-- YALNIZCA ÖNERİ — bu turda ÇALIŞTIRILMADI.
REVOKE EXECUTE ON FUNCTION public.initiate_ownership_transfer(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_ownership_transfer(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_ownership_transfer(text) FROM authenticated;
-- list_my_pending_outgoing_transfers salt-okunur/zararsız — kapatılması
-- gerekmeyebilir, ama tutarlılık için aynı gruba dahil edilebilir.

GRANT EXECUTE ON FUNCTION public.initiate_ownership_transfer(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_ownership_transfer(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_ownership_transfer(text) TO service_role;
```

Bu değişiklikten SONRA, sahiplik devrini açığa çıkarmak isteyen bir
Next.js route'u **service_role** ile bu RPC'leri çağırmak ZORUNDA kalır
— tam da bu turda kaldırılan `/api/ownership-transfer*` route'larının
YAPISI, ama artık gerçek bir güvenlik sınırı olarak (çünkü `authenticated`
rolünün artık bu fonksiyonları çağırma yetkisi yok). Pilot bayrağı
`true` olduğunda bu route'lar GERİ eklenebilir ve o zaman gerçekten işe
yarar.

**Seçenek B — RPC'nin kendi içine bir "pilot kapalı" kontrolü ekle:**
Fonksiyonun gövdesine (DB tarafında) bir `app_settings`/config tablosu
okuyup pilot kapalıyken `RAISE EXCEPTION` eden bir kontrol eklemek —
daha esnek (kod deploy'u gerektirmeden DB'den açıp kapatılabilir) ama
daha karmaşık, fonksiyon gövdesinin değiştirilmesini gerektirir.

**Öneri**: Seçenek A, daha az riskli ve pilot kapsamı için yeterli.

### Rollback planı

```sql
GRANT EXECUTE ON FUNCTION public.initiate_ownership_transfer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_ownership_transfer(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_ownership_transfer(text) TO authenticated;
```

### Risk değerlendirmesi

- **Orta risk**: eğer başka bir (bu incelemede görülmeyen) istemci kodu
  bu RPC'leri `authenticated` rolüyle çağırıyorsa, bu değişiklik o kodu
  kırar. Uygulama öncesi repo genelinde `supabase.rpc(` çağrıları
  taranmalı (bu turda tarandı — `bireysel/araclar/[id]/devret/page.tsx`
  DIŞINDA başka bir çağıran bulunamadı, ama bu kesin garanti değildir,
  yalnızca bu repodaki kod tabanı için geçerlidir).
- **Düşük geri alma riski**: GRANT/REVOKE anlık ve geri alınabilir,
  veri kaybı riski yok.

---

## 3) QR eşleştirme — güvenli sürüm (ayrı iş kalemi)

### Mevcut durum (bu turda netleştirildi, değiştirilmedi)

- Araç oluşturma **hiçbir QR üretmiyor** — QR'lar tamamen ayrı bir havuz
  akışıyla (`/api/qr-uretim`, servis-rolü, gerçek DB-seviyeli kapalı)
  önceden üretiliyor ve sonradan (`/api/qr-eslestir`) bir araca
  atanıyor.
- QR eşleştirme ekranı (`/panel/eslestir`) şu an **tamamen kapalı**
  (`PILOT_FLAGS.qrMatchingSelfService = false`) — kamera ile tarama hiç
  yok, yalnızca manuel kısa-kod girişi vardı ve bu da güvenilmez
  bulunduğu için kapatıldı.

**Açık iddia**: bu sistem şu anki haliyle **fiziksel NFC+QR anahtarlık
pilotuna hazır DEĞİLDİR** — eşleştirme akışının tamamı kapalı. Bu, ayrı
bir iş kalemi (**SECURITY FIX 04**) olarak ele alınmalı.

### SECURITY FIX 04 kapsam taslağı (yalnızca ana hatlar — detaylı tasarım ayrı bir tur)

1. Kamera ile QR tarama (`getUserMedia` + bir barkod/QR okuma
   kütüphanesi) — kullanıcı fiziksel etiketi taramalı, kodu ELLE
   yazmamalı.
2. Eşleştirme isteği tek kullanımlık, kısa ömürlü bir doğrulama adımı
   içermeli (ör. taranan kod + aracın son 4 hanesi/plaka teyidi gibi
   ikinci bir faktör) — yanlış araca yanlışlıkla eşleştirmeyi önlemek
   için.
3. Rate limiting: aynı kullanıcı/IP'den kısa sürede çok sayıda
   eşleştirme denemesi (kod tahmin etmeye çalışma) engellenmeli.
4. Yukarıdaki RPC EXECUTE modeliyle tutarlı olarak, eşleştirme yazma
   işlemi servis-rolü ile (mevcut `/api/qr-eslestir` deseni) yapılmaya
   devam etmeli — bu KISIM zaten doğru kurulu, değişmesi gerekmiyor.
5. Kabul testleri: yanlış kod → net hata; zaten atanmış kod → net hata;
   iptal edilmiş kod → net hata; başarılı eşleştirme → audit_log'a
   `trg_log_qr_key_assigned`in doğru tetiklendiğinin doğrulanması (bu
   turda trigger'ın yalnızca INSERT'te tetiklendiği, ama eşleştirmenin
   bir UPDATE olduğu fark edildi — **bu bir tutarsızlık olabilir**,
   SECURITY FIX 04 kapsamında ayrıca incelenmeli: eşleştirme audit_log'a
   gerçekten düşüyor mu, yoksa yalnızca ilk kod üretiminde mi?).

---

## 4) Uygulama sırası önerisi

1. Önce **madde 1** (plaka UNIQUE indeksi) — en düşük risk, en izole.
2. Sonra **madde 2 Seçenek A** (RPC EXECUTE kısıtlaması) — orta risk,
   repo geneli `rpc(` taraması tamamlandıktan sonra.
3. **Madde 3** (QR güvenli sürüm) ayrı, daha büyük bir tasarım+uygulama
   turu olarak planlanmalı — bu proposal yalnızca kapsamı çerçeveliyor.

## 5) Gerçek entegrasyon test matrisi (bu değişiklikler uygulandıktan SONRA, gerçek DB'ye karşı çalıştırılmalı)

Bu sandbox ortamının Supabase'e ağ erişimi olmadığı için bu testler
BURADA yazılıp çalıştırılamadı — bir sonraki turda, gerçek (tercihen
ayrı bir staging) Supabase projesine karşı yazılmalı:

| # | Senaryo | Beklenen |
|---|---|---|
| 1 | Aynı tenant içinde aynı plakayla eşzamanlı (Promise.all) iki gerçek INSERT | Biri başarılı, diğeri `23505` → uygulama 409 döner |
| 2 | `authenticated` rolüyle gerçek bir token kullanarak doğrudan `initiate_ownership_transfer` RPC'sini çağırma (madde 2 uygulandıktan sonra) | `permission denied for function` hatası |
| 3 | Gerçek bireysel kullanıcı JWT'siyle `/api/vehicles`'a POST (madde 2/3 sonrası user-JWT geçişi) | Başarılı insert, RLS reddetmiyor |
| 4 | Başka bir tenant'ın `vehicle_id`'siyle `/api/qr-eslestir` çağrısı | 403, hiçbir satır güncellenmiyor |
| 5 | `trg_log_vehicle_created`in user-JWT ile yapılan insert sonrası da tetiklendiğinin audit_log'dan doğrulanması | Yeni bir audit_log satırı oluşur |

Bu tablo bir **plan**dır, bu turda hiçbir satırı gerçek bir DB'ye karşı
çalıştırılmadı.
