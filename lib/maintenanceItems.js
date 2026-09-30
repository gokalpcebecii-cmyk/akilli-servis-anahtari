"use strict";

// OTOİZ Aşama E — bakım kalemleri tek kaynak (etiket + varsayılan periyot).
// Anahtarlar maintenance_items_item_key_check ile birebir aynı olmalı.
const ITEM_LABELS = {
  motor_yagi: "Motor Yağı",
  yag_filtresi: "Yağ Filtresi",
  hava_filtresi: "Hava Filtresi",
  polen_filtresi: "Polen Filtresi",
  yakit_filtresi: "Yakıt Filtresi",
  fren_balatasi: "Fren Balatası",
  fren_on_balata: "Ön Fren Balatası",
  fren_arka_balata: "Arka Fren Balatası",
  fren_diski: "Fren Diski",
  sanziman_yagi: "Şanzıman Yağı",
  antifriz: "Antifriz",
  aku: "Akü",
  lastik: "Lastik",
  triger_seti: "Triger Seti",
  buji: "Buji",
  silecek: "Silecek",
  fren_disk_balata: "Fren Disk-Balata",
};

const DEFAULT_INTERVALS = {
  motor_yagi: 10000,
  yag_filtresi: 10000,
  hava_filtresi: 15000,
  polen_filtresi: 15000,
  yakit_filtresi: 30000,
  fren_balatasi: 20000,
  fren_on_balata: 20000,
  fren_arka_balata: 20000,
  fren_diski: 60000,
  sanziman_yagi: 60000,
  antifriz: 40000,
  aku: 30000,
  lastik: 40000,
  triger_seti: 60000,
  buji: 30000,
  silecek: 20000,
};

// Servis hızlı kayıt: ilk ekranda görünen 11 hızlı seçim (+ "Diğer").
const SERVICE_QUICK_KEYS = [
  "motor_yagi",
  "yag_filtresi",
  "hava_filtresi",
  "polen_filtresi",
  "yakit_filtresi",
  "fren_balatasi",
  "fren_diski",
  "sanziman_yagi",
  "antifriz",
  "aku",
  "lastik",
];
// "Daha fazla işlem" altında (mevcut kayıtlarla uyum için korunur).
const SERVICE_MORE_KEYS = ["fren_on_balata", "fren_arka_balata", "triger_seti", "buji", "silecek"];

// Sonraki bakım seçenekleri (servis hızlı kayıt + yeni araç).
const NEXT_PLAN_OPTIONS = [
  { key: "default", label: "+10.000 km / 12 ay" },
  { key: "extended_km", label: "+15.000 km / 12 ay" },
  { key: "extended_months", label: "+10.000 km / 6 ay" },
  { key: "custom", label: "Özel" },
  { key: "later", label: "Sonra belirle" },
];

// Nihai UX: servis hızlı kayıt, bireysel hızlı kayıt ve geçmiş işlem ekleme
// aynı seçilebilir işlem ızgarasını kullanır (sırası brifteki gibi; sonda
// "Diğer" ayrı eklenir). "Daha fazla işlem" açılımı yok.
const QUICK_GRID_KEYS = [
  "motor_yagi",
  "yag_filtresi",
  "hava_filtresi",
  "polen_filtresi",
  "yakit_filtresi",
  "fren_on_balata",
  "fren_arka_balata",
  "fren_diski",
  "sanziman_yagi",
  "antifriz",
  "aku",
  "lastik",
  "buji",
  "silecek",
  "triger_seti",
];
// Izgarada kısa ad (kayıt açıklaması ITEM_LABELS ile yazılmaya devam eder).
const CHIP_LABELS = { ...ITEM_LABELS, triger_seti: "Triger" };

// Periyodik bakımı başlatan işlemler: sonraki bakım hesabı yalnız bunlardan
// birini içeren en son kayda göre başlar (ör. yalnız silecek değişimi bakım
// sayacını sıfırlamaz).
const PERIODIC_KEYS = ["motor_yagi", "yag_filtresi", "hava_filtresi", "polen_filtresi", "yakit_filtresi"];

module.exports = { ITEM_LABELS, DEFAULT_INTERVALS, SERVICE_QUICK_KEYS, SERVICE_MORE_KEYS, NEXT_PLAN_OPTIONS, QUICK_GRID_KEYS, CHIP_LABELS, PERIODIC_KEYS };
