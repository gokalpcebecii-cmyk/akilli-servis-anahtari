// OTOİZ P1 — tarayıcı tarafı: giriş/şifre hatasını Sistem Sağlığı'na bildir.
// Ateşle-unut; kullanıcı akışını asla bekletmez ya da bozmaz. Kişisel veri yok.
export function reportClientEvent(kind: "login_failed" | "auth_error", area: "bireysel" | "servis" | "yonetim" | "sifre" | "mfa", code?: string | null) {
  try {
    const payload = JSON.stringify({ kind, area, code: code ?? null });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/olay", new Blob([payload], { type: "application/json" }));
      return;
    }
    fetch("/api/olay", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
  } catch {
    /* yoksay */
  }
}
