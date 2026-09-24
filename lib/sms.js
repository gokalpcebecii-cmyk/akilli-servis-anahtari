async function sendSms(phone, message) {
  const provider = process.env.SMS_PROVIDER;

  if (!provider) {
    // KVKK: kuru çalıştırma logunda telefon ve mesaj içeriği (ad, plaka)
    // yazılmaz — yalnız maskeli numara ve mesaj uzunluğu.
    const digits = String(phone || "").replace(/\D/g, "");
    const masked = digits.length >= 4 ? `***${digits.slice(-2)}` : "***";
    console.log(`[SMS - DRY RUN, gonderilmedi] -> ${masked} (${String(message || "").length} karakter)`);
    return { ok: true, dryRun: true };
  }

  if (provider === "netgsm") {
    throw new Error("Netgsm entegrasyonu henuz baglanmadi - NETGSM_USERCODE/PASSWORD ekleyin.");
  }

  if (provider === "twilio") {
    throw new Error("Twilio entegrasyonu henuz baglanmadi - TWILIO_ACCOUNT_SID/AUTH_TOKEN ekleyin.");
  }

  return { ok: false, error: "bilinmeyen SMS_PROVIDER" };
}

module.exports = { sendSms };
