"use strict";

// OTOİZ Aşama E.1 (telefon testi düzeltmesi): marka/model listesi üzerinde
// eşleştirme ve arama (unit testli). Liste verisi sunucudan
// (/api/arac-katalogu) yüklenir ve bu fonksiyonlara parametre olarak verilir;
// istemci paketine liste gömülmez. Liste biçimi: [{ name, models: [...] }].

// Eşleştirme ve arama anahtarı: büyük/küçük harf, boşluk/nokta/tire ve
// Türkçe/aksanlı harf farkı yok sayılır ("FIAT" = "fiat", "citroen" =
// "Citroën"). tr-TR küçültme "I"yı "ı" yaptığı için ı da i'ye sadeleşir.
function norm(s) {
  return String(s || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[\s._-]+/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const searchKey = norm;

// Katalogdaki yazılışı döndürür (büyük/küçük harf ve boşluk farkı yok sayılır).
function findBrand(brands, name) {
  const n = norm(name);
  if (!n) return null;
  const hit = (brands || []).find((b) => norm(b.name) === n);
  return hit ? hit.name : null;
}

function modelsFor(brands, brand) {
  const n = norm(brand);
  const hit = (brands || []).find((b) => norm(b.name) === n);
  return hit ? hit.models : [];
}

function findModel(brands, brand, model) {
  const n = norm(model);
  if (!n) return null;
  return modelsFor(brands, brand).find((m) => norm(m) === n) || null;
}

// Mevcut bir kaydın seçiciye nasıl açılacağı. Listede olmayan değerler
// "manual" modda AYNEN korunur (kayıt değiştirilmez).
function pickerState(brands, brand, model) {
  const b = findBrand(brands, brand);
  const brandText = String(brand || "");
  const modelText = String(model || "");
  if (!brandText.trim()) return { brandMode: "list", brand: "", modelMode: "list", model: modelText };
  if (!b) return { brandMode: "manual", brand: brandText, modelMode: "manual", model: modelText };
  const m = findModel(brands, b, modelText);
  if (!modelText.trim()) return { brandMode: "list", brand: b, modelMode: "list", model: "" };
  // Katalogla eşleşse de kayıttaki yazılış aynen kalır; seçici yalnız eşleşeni gösterir.
  return m ? { brandMode: "list", brand: b, modelMode: "list", model: m } : { brandMode: "list", brand: b, modelMode: "manual", model: modelText };
}

// Arama: önce baştan eşleşenler, sonra içinde geçenler; liste sırası korunur.
function searchNames(names, query) {
  const q = searchKey(query);
  if (!q) return names.slice();
  const starts = [];
  const contains = [];
  for (const n of names) {
    const k = searchKey(n);
    if (k.startsWith(q)) starts.push(n);
    else if (k.includes(q)) contains.push(n);
  }
  return starts.concat(contains);
}

module.exports = { norm, searchKey, findBrand, modelsFor, findModel, pickerState, searchNames };
