// OTOİZ — tek parola kuralı (sunucu + istemci aynı kaynaktan).
const MIN_PASSWORD_LENGTH = 8;

function validatePassword(pw) {
  if (typeof pw !== "string" || pw.length < MIN_PASSWORD_LENGTH) {
    return `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`;
  }
  return null;
}

// Müşterinin profilinde gösterilen, yönetici tanımlamasında istenen hesap
// kodu: kullanıcı kimliğinin (UID) ilk 8 onaltılık karakteri, büyük harf.
function accountCodeFromUserId(userId) {
  return String(userId || "").replace(/-/g, "").slice(0, 8).toUpperCase();
}

module.exports = { MIN_PASSWORD_LENGTH, validatePassword, accountCodeFromUserId };
