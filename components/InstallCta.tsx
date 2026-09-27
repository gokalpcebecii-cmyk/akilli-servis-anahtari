"use client";

// OTOİZ Aşama C — "OTOİZ'İ TELEFONA EKLE".
//
// - Android (Chrome/Edge): tarayıcı yükleme penceresi (beforeinstallprompt)
//   hazırsa doğrudan onu açar; hazır değilse (Samsung Internet, daha önce
//   reddedilmiş vb.) menüden "Ana ekrana ekle" yönergesini gösterir.
// - iOS: Safari'de Paylaş → Ana Ekrana Ekle → Ekle yönergesi.
// - Masaüstü: gösterilmez.
// - Uygulama olarak açıldıysa (display-mode: standalone / navigator.standalone),
//   yüklendi bilgisi alındıysa (appinstalled, pencerede "Yükle", iOS'ta
//   "Ekledim") veya kullanıcı "Şimdi değil" dediyse (7 gün) gösterilmez.
// Sunucuya hiçbir şey gönderilmez; durum yalnız bu tarayıcının
// localStorage'ında tutulur.
import { useCallback, useEffect, useRef, useState } from "react";
import { colors, font } from "@/lib/theme";
import { Icon } from "@/components/Icon";

type Platform = "ios" | "android" | "other";
type Deferred = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const INSTALLED_KEY = "otoiz-pwa-installed";
const SNOOZE_KEY = "otoiz-pwa-snooze-until";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

// beforeinstallprompt sayfa yüklenirken, bileşen henüz görünmeden gelebilir;
// modül yüklenir yüklenmez yakalanır ve saklanır.
let deferredPrompt: Deferred | null = null;
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as Deferred;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    store(INSTALLED_KEY, "1");
    notify();
  });
}

function store(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Gizli sekme vb.: yalnız bu oturum için gizlenir.
  }
}
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function detectPlatform(ua: string, platform = "", touchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/i.test(ua) || (platform === "MacIntel" && touchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function isStandalone(): boolean {
  try {
    if ((window.navigator as any).standalone === true) return true;
    return ["standalone", "fullscreen", "minimal-ui"].some((m) => window.matchMedia(`(display-mode: ${m})`).matches);
  } catch {
    return false;
  }
}

export function InstallCta({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [platform, setPlatform] = useState<Platform>("other");
  const [hasPrompt, setHasPrompt] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(() => {
    const p = detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints || 0);
    setPlatform(p);
    setHasPrompt(!!deferredPrompt);
    if (isStandalone()) {
      // Uygulama içinden açıldı: bu cihazda yüklü.
      store(INSTALLED_KEY, "1");
      setHidden(true);
      return;
    }
    const snoozed = Number(read(SNOOZE_KEY) || 0) > Date.now();
    setHidden(p === "other" || read(INSTALLED_KEY) === "1" || snoozed);
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (!sheet) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSheet(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  function closeSheet() {
    setSheet(false);
    openerRef.current?.focus();
  }

  async function handleClick() {
    if (platform === "android" && deferredPrompt) {
      setBusy(true);
      const d = deferredPrompt;
      try {
        await d.prompt();
        const choice = await d.userChoice;
        // Aynı olay yalnız bir kez kullanılabilir.
        deferredPrompt = null;
        if (choice.outcome === "accepted") {
          store(INSTALLED_KEY, "1");
          setHidden(true);
        }
      } catch {
        deferredPrompt = null;
        setSheet(true);
      } finally {
        setBusy(false);
        setHasPrompt(!!deferredPrompt);
      }
      return;
    }
    setSheet(true);
  }

  function markAdded() {
    store(INSTALLED_KEY, "1");
    setSheet(false);
    setHidden(true);
  }

  function snooze() {
    store(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setSheet(false);
    setHidden(true);
  }

  if (!mounted || hidden) return null;

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const iosNonSafari = platform === "ios" && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  const isIpad = platform === "ios" && !/iPhone|iPod/i.test(ua);

  return (
    <>
      <div className={`otoiz-install otoiz-install-${tone}`} data-testid="install-cta" data-platform={platform}>
        <div className="otoiz-install-head">
          <span className="otoiz-install-icon" aria-hidden="true">
            <Icon name="smartphone" color={colors.green} size={22} />
          </span>
          <div>
            <div className="otoiz-install-title">OTOİZ&apos;i ana ekranınıza ekleyin</div>
            <div className="otoiz-install-sub">Uygulama gibi tek dokunuşla açılır, adres yazmanız gerekmez.</div>
          </div>
        </div>
        <button
          ref={openerRef}
          type="button"
          onClick={handleClick}
          disabled={busy}
          aria-haspopup={platform === "android" && hasPrompt ? undefined : "dialog"}
          className="otoiz-install-btn"
          style={{ fontFamily: font }}
        >
          <Icon name="download" color={colors.textDark} size={20} />
          OTOİZ&apos;İ TELEFONA EKLE
        </button>
        <button type="button" onClick={snooze} className="otoiz-install-later" style={{ fontFamily: font }}>
          Şimdi değil
        </button>
      </div>

      {sheet && (
        <div className="otoiz-install-backdrop" onClick={closeSheet}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="otoiz-install-sheet-title"
            className="otoiz-install-sheet"
            data-testid={platform === "ios" ? "install-sheet-ios" : "install-sheet-android"}
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: font }}
          >
            <div className="otoiz-install-sheet-head">
              <h2 id="otoiz-install-sheet-title">
                {platform === "ios" ? (isIpad ? "iPad'e ekle" : "iPhone'a ekle") : "Android telefona ekle"}
              </h2>
              <button ref={closeRef} type="button" onClick={closeSheet} aria-label="Kapat" className="otoiz-install-close">
                <Icon name="close" color={colors.textDark} size={20} />
              </button>
            </div>

            {platform === "ios" ? (
              <ol className="otoiz-install-steps">
                <li>
                  <span className="otoiz-install-step-no">1</span>
                  <span>
                    {iosNonSafari ? "Adres çubuğundaki " : isIpad ? "Sağ üstteki " : "Alttaki "}
                    <strong className="otoiz-install-kbd">
                      <Icon name="share" color={colors.textDark} size={16} /> Paylaş
                    </strong>{" "}
                    simgesine dokunun.
                  </span>
                </li>
                <li>
                  <span className="otoiz-install-step-no">2</span>
                  <span>
                    Listeyi kaydırıp{" "}
                    <strong className="otoiz-install-kbd">
                      <Icon name="plus-square" color={colors.textDark} size={16} /> Ana Ekrana Ekle
                    </strong>{" "}
                    seçeneğine dokunun.
                  </span>
                </li>
                <li>
                  <span className="otoiz-install-step-no">3</span>
                  <span>
                    Sağ üstteki <strong>Ekle</strong>&apos;ye dokunun. OTOİZ simgesi ana ekranınızda görünür.
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="otoiz-install-steps">
                <li>
                  <span className="otoiz-install-step-no">1</span>
                  <span>
                    Tarayıcının sağ üstündeki{" "}
                    <strong className="otoiz-install-kbd">
                      <Icon name="more-vertical" color={colors.textDark} size={16} /> menü
                    </strong>{" "}
                    simgesine dokunun (Samsung İnternet&apos;te alttaki ☰).
                  </span>
                </li>
                <li>
                  <span className="otoiz-install-step-no">2</span>
                  <span>
                    <strong>Uygulamayı yükle</strong> ya da <strong>Ana ekrana ekle</strong> seçeneğine dokunun.
                  </span>
                </li>
                <li>
                  <span className="otoiz-install-step-no">3</span>
                  <span>
                    <strong>Yükle</strong> / <strong>Ekle</strong> ile onaylayın. OTOİZ simgesi ana ekranınızda görünür.
                  </span>
                </li>
              </ol>
            )}

            {iosNonSafari && (
              <p className="otoiz-install-note">Seçenek görünmüyorsa bu sayfayı Safari&apos;de açıp aynı adımları izleyin.</p>
            )}

            <button type="button" onClick={markAdded} className="otoiz-install-btn" style={{ fontFamily: font }}>
              <Icon name="check" color={colors.textDark} size={20} />
              Ekledim
            </button>
            <button type="button" onClick={closeSheet} className="otoiz-install-later otoiz-install-later-light" style={{ fontFamily: font }}>
              Kapat
            </button>
          </div>
        </div>
      )}
    </>
  );
}
