"use strict";

// OTOİZ Aşama E.1: marka → model seçim listesi (unit testli).
//
// Türkiye'de yaygın binek ve hafif ticari araçlar. Liste yalnız seçim
// kolaylığı içindir: veritabanında marka ve model eskisi gibi düz metin
// olarak saklanır. Listede olmayan araç "Diğer / Elle gir" ile yazılır;
// listede olmayan eski kayıtlar da elle giriş modunda aynen açılır, hiçbir
// kayıt değiştirilmez.

const CATALOG = [
  ["Alfa Romeo", ["Giulia", "Giulietta", "Stelvio", "Tonale"]],
  ["Audi", ["A1", "A3", "A4", "A5", "A6", "A7", "A8", "Q2", "Q3", "Q5", "Q7", "Q8", "e-tron", "TT"]],
  ["BMW", ["1 Serisi", "2 Serisi", "3 Serisi", "4 Serisi", "5 Serisi", "7 Serisi", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "iX", "i4"]],
  ["BYD", ["Atto 3", "Dolphin", "Han", "Seal", "Seal U", "Tang"]],
  ["Chery", ["Omoda 5", "Tiggo 4", "Tiggo 7", "Tiggo 8"]],
  ["Citroën", ["Berlingo", "C-Elysée", "C3", "C3 Aircross", "C4", "C4 X", "C5 Aircross", "Jumper", "Jumpy"]],
  ["Cupra", ["Born", "Formentor", "Leon"]],
  ["Dacia", ["Duster", "Jogger", "Logan", "Sandero", "Sandero Stepway", "Spring"]],
  ["DS", ["DS 3", "DS 4", "DS 7", "DS 9"]],
  ["Fiat", ["500", "500X", "Doblo", "Egea", "Egea Cross", "Fiorino", "Linea", "Panda", "Punto", "Ducato"]],
  ["Ford", ["B-Max", "C-Max", "Courier", "EcoSport", "Fiesta", "Focus", "Kuga", "Mondeo", "Puma", "Ranger", "Tourneo Connect", "Tourneo Courier", "Tourneo Custom", "Transit", "Transit Custom"]],
  ["Honda", ["City", "Civic", "CR-V", "HR-V", "Jazz", "ZR-V"]],
  ["Hyundai", ["Accent", "Bayon", "Elantra", "i10", "i20", "i30", "Ioniq 5", "Kona", "Santa Fe", "Tucson"]],
  ["Jeep", ["Avenger", "Compass", "Grand Cherokee", "Renegade", "Wrangler"]],
  ["Kia", ["Ceed", "EV6", "Niro", "Picanto", "Rio", "Sorento", "Sportage", "Stonic", "XCeed"]],
  ["Land Rover", ["Defender", "Discovery", "Discovery Sport", "Range Rover", "Range Rover Evoque", "Range Rover Sport", "Range Rover Velar"]],
  ["Lexus", ["ES", "NX", "RX", "UX"]],
  ["Mazda", ["2", "3", "6", "CX-3", "CX-30", "CX-5"]],
  ["Mercedes-Benz", ["A Serisi", "B Serisi", "C Serisi", "CLA", "E Serisi", "EQA", "EQB", "EQE", "G Serisi", "GLA", "GLB", "GLC", "GLE", "S Serisi", "Sprinter", "Vito"]],
  ["MG", ["HS", "MG4", "ZS"]],
  ["Mini", ["Cooper", "Countryman", "Clubman"]],
  ["Mitsubishi", ["ASX", "Eclipse Cross", "L200", "Outlander", "Space Star"]],
  ["Nissan", ["Juke", "Micra", "Navara", "Qashqai", "X-Trail"]],
  ["Opel", ["Astra", "Combo", "Corsa", "Crossland", "Grandland", "Insignia", "Mokka", "Vivaro", "Zafira"]],
  ["Peugeot", ["2008", "208", "3008", "301", "308", "408", "5008", "508", "Boxer", "Expert", "Partner", "Rifter"]],
  ["Porsche", ["911", "Cayenne", "Macan", "Panamera", "Taycan"]],
  ["Renault", ["Austral", "Captur", "Clio", "Fluence", "Kadjar", "Kangoo", "Koleos", "Megane", "Symbol", "Taliant", "Trafic", "Master"]],
  ["Seat", ["Arona", "Ateca", "Ibiza", "Leon", "Tarraco"]],
  ["Skoda", ["Fabia", "Kamiq", "Karoq", "Kodiaq", "Octavia", "Scala", "Superb"]],
  ["Subaru", ["Forester", "Outback", "XV"]],
  ["Suzuki", ["Swift", "S-Cross", "Vitara", "Jimny"]],
  ["Tesla", ["Model 3", "Model Y", "Model S", "Model X"]],
  ["TOGG", ["T10X", "T10F"]],
  ["Toyota", ["Auris", "C-HR", "Corolla", "Corolla Cross", "Hilux", "Proace City", "RAV4", "Yaris", "Yaris Cross"]],
  ["Volkswagen", ["Amarok", "Arteon", "Caddy", "Crafter", "Golf", "ID.3", "ID.4", "Jetta", "Passat", "Polo", "T-Cross", "T-Roc", "Taigo", "Tiguan", "Touareg", "Transporter"]],
  ["Volvo", ["EX30", "S60", "S90", "V40", "V60", "XC40", "XC60", "XC90"]],
];

const BRANDS = CATALOG.map(([b]) => b);
const MODELS = new Map(CATALOG);

function norm(s) {
  return String(s || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[\s._-]+/g, "")
    .replace(/ë/g, "e");
}

// Katalogdaki yazılışı döndürür (büyük/küçük harf ve boşluk farkı yok sayılır).
function findBrand(name) {
  const n = norm(name);
  if (!n) return null;
  return BRANDS.find((b) => norm(b) === n) || null;
}

function modelsFor(brand) {
  const b = findBrand(brand);
  return b ? MODELS.get(b) : [];
}

function findModel(brand, model) {
  const n = norm(model);
  if (!n) return null;
  return modelsFor(brand).find((m) => norm(m) === n) || null;
}

// Mevcut bir kaydın seçiciye nasıl açılacağı. Listede olmayan değerler
// "manual" modda AYNEN korunur (kayıt değiştirilmez).
function pickerState(brand, model) {
  const b = findBrand(brand);
  const brandText = String(brand || "");
  const modelText = String(model || "");
  if (!brandText.trim()) return { brandMode: "list", brand: "", modelMode: "list", model: modelText };
  if (!b) return { brandMode: "manual", brand: brandText, modelMode: "manual", model: modelText };
  const m = findModel(b, modelText);
  if (!modelText.trim()) return { brandMode: "list", brand: b, modelMode: "list", model: "" };
  // Katalogla eşleşse de kayıttaki yazılış aynen kalır; seçici yalnız eşleşeni gösterir.
  return m ? { brandMode: "list", brand: b, modelMode: "list", model: m } : { brandMode: "list", brand: b, modelMode: "manual", model: modelText };
}

module.exports = { CATALOG, BRANDS, findBrand, modelsFor, findModel, pickerState };
