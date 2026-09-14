async function sendSms(phone, message) {
  const provider = process.env.SMS_PROVIDER;

  if (!provider) {
    console.log(`[SMS - DRY RUN, gonderilmedi] -> ${phone}: ${message}`);
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
