# OTOİZ — Production migration planı (20 kullanıcı pilotu)

> Bu belge yalnızca plandır. Production'a hiçbir yazma yapılmadı. Uygulama, proje sahibinin açık onayından sonra yapılır.

## 1. Mevcut durum (salt-okuma ile doğrulandı)

- Production projesi: `sbfsiwqxbsojcxdutnem`.
- Production `supabase_migrations.schema_migrations` defterinde 18–19 Eylül tarihli 9 eski kayıt var. Bu repodaki dosya adlarıyla eşleşmiyorlar.
- Production şeması, repodaki `baseline_01..05` dosyalarının uygulandığı temiz bir veritabanıyla **yapısal olarak birebir aynı**. Karşılaştırma: kolonlar, kısıtlar, indeksler, policy'ler, RLS, fonksiyon gövdeleri, trigger'lar. Tek fark ACL satırlarında ve orada production daha sıkı.
- Production verisi yeni kısıtlarla uyumlu:
  - Araç başına birden fazla aktif QR yok.
  - Geçersiz `item_key` yok.
  - Açık devir yok.
  - 2 servis, 4 araç, 7 QR, 4 kullanıcı var.
- 7 QR kodunun tamamı kısa (<26 karakter, <128 bit). Ayrıntı için §4 adım 6'ya bakın.

## 2. Defter uzlaştırma (repair) — manuel "atlama" yok

`baseline_01..05` production'da zaten var olan şemanın aynısıdır. Bu yüzden **çalıştırılmaz**, yalnızca uygulanmış olarak işaretlenir:

```
supabase migration repair --status applied 20260922171937 20260922171957 20260922172024 20260922172056 20260922172110
```

Eski 9 defter kaydı olduğu gibi bırakılır. Bunlar tarih kaydıdır ve silinmez.

## 3. Production'a uygulanacak migration listesi (bu sırayla, tek geçişte)

| # | Sürüm | Dosya |
|---|---|---|
| 1 | 20260922174352 | qr_pilot_lockdown |
| 2 | 20260922174406 | grant_tightening |
| 3 | 20260922174458 | security_definer_hardening |
| 4 | 20260922212656 | grant_qr_keys_write_to_authenticated (**no-op**; staging'deki orijinali `supabase/staging_history/`) |
| 5 | 20260922212719 | add_missing_qr_keys_write_policies (**no-op**; aynı gerekçe) |
| 6 | 20260922222343 | relock_qr_keys_and_vehicle_tenant_guard |
| 7 | 20260922232055 | tenants_private_and_owner_update |
| 8 | 20260922232651 | passport_mask_plate |
| 9 | 20260922234026 | istanbul_date_defaults (veri UPDATE'i çıkarıldı → `supabase/data_fixes/`) |
| 10 | 20260923172303 | platform_admin_and_qr_reservation |
| 11 | 20260923172734 | maintenance_items_new_keys |
| 12 | 20260923180038 | platform_admins_service_role_grant |
| 13 | 20260923193516 | passport_record_verified_flag |
| 14 | 20260923194539 | qr_user_reservation |
| 15 | 20260923202534 | revoke_rls_auto_enable_execute (fonksiyon yoksa koşullu atlanır) |
| 16 | 20260923205050 | service_approval (mevcut servisler `approved`, yeni servisler `pending`) |
| 17 | 20260923205102 | qr_audit_triggers_and_revoked_guard |
| 18 | 20260923205128 | ownership_transfer_v2 |
| 19 | 20260923205143 | atomic_service_visit |
| 20 | 20260923205145 | grant_hardening |
| 21 | 20260923210257 | trigger_function_execute_revoke |

Kanıt:
- 26 dosyanın tamamı, boş bir baseline veritabanına tek geçişte hatasız uygulanıyor (chain_fail=0).
- Sonuç şema, staging'in şemasıyla parmak izi karşılaştırmasında eşit. Tek istisna yorum satırı farkı olan `guard_vehicle_tenant_change` gövdesi.

`supabase/data_fixes/20260922234026_backfill_service_date_istanbul.sql` production paketine **dahil değildir**. Tek seferlik bir veri düzeltmesidir, ayrı onayla çalıştırılır. Production'da gerekmeyebilir.

## 4. Uygulama sırası (onaydan sonra)

1. Supabase production için yedek / PITR noktası alınır.
2. §2 repair çalıştırılır. Ardından §3 listesi `supabase db push` ile uygulanır.
3. `supabase/tests/pilot_acceptance.sql` **production'da çalıştırılmaz**, çünkü test kullanıcı kimlikleri staging'e ait. Bunun yerine salt-okuma parmak izi karşılaştırması yapılır.
4. Vercel production ortam değişkenleri eklenir:
   - `OTOIZ_DEPLOYMENT_ROLE=production`
   - `OTOIZ_EXPECTED_SUPABASE_REF=sbfsiwqxbsojcxdutnem`
   - `CRON_SECRET` (en az 16 karakter; staging'dekinden farklı olmalı)
5. PR #5 `main`'e merge edilir → Vercel build'inde ortam kapısı çalışır:
   - Rol, branch ve Supabase ref uyumu kontrol edilir.
   - Anahtarlar canlı olarak doğrulanır.
6. **Kısa QR kodlarının değiştirilmesi — PİLOT BAŞLAMADAN ÖNCE ZORUNLU** (ayrıntı §4.1).
7. Supabase Auth ayarları (dashboard):
   - Minimum şifre uzunluğu 8.
   - Leaked password protection açık (planın destekliyorsa).

### 4.1 Production'daki 7 kısa QR kodunun değiştirilmesi (pilot öncesi, zorunlu)

Salt-okuma sorgusuyla tespit edildi (24.09.2026). Kodların hepsi 10–12 karakter, yani <128 bit:

| Kod | Durum | Yapılacak |
|---|---|---|
| zye3paww6v, 6ve8wamtb8, phcbfws5e7, 76hherns9m | Boşta (araca bağlı değil) | İptal et |
| 69czghtnp7 | Servis aracı 06SGD48'e bağlı | Yeni kodla değiştir |
| q882a77gwt4c | Bireysel araç 06ELİZ23'e bağlı | Yeni kodla değiştir |
| mpw8hhdrqz32 | Bireysel araç 06otoiz01'e bağlı | Yeni kodla değiştir |

Sıra: migration'lar uygulanıp yeni sürüm production'a çıktıktan **sonra**, ilk pilot kullanıcı eklenmeden **önce**. Tüm adımlar `/yonetim` panelinden yapılır; hepsi audit_log'a yazılır.

1. **Üret:** QR Kodları sekmesi → "Yeni parti" → adet 3 (bağlı araçlar için) + pilotta dağıtılacak adet (ör. 20). Etiket: `Pilot-v1`. Bu kodlar 26 karakterlidir.
2. **Bas:** 3 bağlı araç için yeni anahtarlıklar basılır. Etiket basılmadan eski kod iptal edilmez; yoksa araç sahibinin elindeki QR boşa düşer.
3. **Boştaki 4 kodu iptal et:** QR Kodları → ilgili kod → "İptal". İptal geri alınamaz; pasaport açılmaz, kod başka araca bağlanamaz.
4. **Bağlı 3 kodu değiştir (her araç için sırayla):**
   - a. Eski kodu iptal et. Araç aktif QR'sız kalır; bakım geçmişi ve vehicle_id değişmez.
   - b. Aynı araca yeni 26 karakterlik kodu "Araca bağla" ile tanımla. Sistem araç başına tek aktif QR'a izin verir, bu yüzden önce (a) yapılmalıdır.
   - c. Yeni anahtarlığı araç sahibine/servise teslim et. Eski fiziksel anahtarlık artık "bulunamadı" gösterir.
5. **Doğrula (salt-okuma):**
   ```sql
   select count(*) from public.qr_keys where length(code) < 26 and revoked_at is null;          -- 0 olmalı
   select count(*) from (select vehicle_id from public.qr_keys where vehicle_id is not null and revoked_at is null
                         group by vehicle_id having count(*) > 1) d;                            -- 0 olmalı
   select plate from public.vehicles v where not exists (select 1 from public.qr_keys q where q.vehicle_id=v.id and q.revoked_at is null)
     and v.plate in ('06SGD48','06ELİZ23','06otoiz01');                                         -- boş olmalı
   ```
6. Her araç için `/p/<yeni-kod>` pasaportunun açıldığı, `/p/<eski-kod>` adresinin açılmadığı kontrol edilir.

Kabul kriteri: aktif kısa kod sayısı 0; 3 aracın her biri tek aktif 26 karakterlik QR'a sahip; `qr_key_revoked` + `qr_key_assigned` audit kayıtları mevcut.

## 5. Geri dönüş (rollback) testi ve planı

Test: Eski production uygulamasının (`main`, 1f4a93e) istemci çağrıları, yeni şemalı staging veritabanında aynı rollerle çalıştırıldı. İşlem transaction içindeydi ve sonunda geri alındı.

| Akış | Sonuç |
|---|---|
| Servis: araç km güncelle / kalem upsert / bakım kaydı ekle | ✅ çalışıyor |
| Bireysel: kalem + kayıt ekle, not güncelle | ✅ çalışıyor |
| Anonim pasaport | ✅ çalışıyor |
| Devir başlat / bekleyen devir listesi | ✅ çalışıyor |
| Bireysel QR iptali (istemciden doğrudan) | ❌ `permission denied` — tasarım gereği |
| Devir iptali (eski `p_token` imzası) | ❌ fonksiyon imzası değişti |
| Servis panelinden devir (istemciden insert) | ❌ `permission denied` — tasarım gereği |
| Eski kodla yeni servis kaydı | ⚠️ servis `pending` kalır, eski arayüz bunu göstermez |

Plan: **Şema geri alınmaz (roll-forward).**
- Yeni uygulamada sorun çıkarsa Vercel'de önceki deployment'a dönülür. Veritabanı yeni şemada kalır.
- Çekirdek akışlar (bakım kaydı, pasaport, araç) eski kodla çalışmaya devam eder.
- Kırılan 3 akış güvenlik kilidinin sonucudur ve bilinçli olarak kapalı kalır.
- Düzeltme ileri yönde yapılır: yeni commit → yeniden deploy.
- Şemanın geri alınması, yani güvenlik kilitlerini açmak **önerilmez**.

## 6. Kalan riskler

- Kayıtta e-posta doğrulaması yok (`email_confirm: true`). Bireysel QR ataması hesap kodu + e-posta eşleşmesiyle korunuyor.
- Leaked password protection ve Auth minimum şifre uzunluğu dashboard'dan ayarlanmalı. Uygulama tarafında minimum 8 zaten zorunlu.
- 7 kısa QR kodu değiştirilene kadar <128 bit.
