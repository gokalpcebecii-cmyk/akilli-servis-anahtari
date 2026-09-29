"use client";

// OTOİZ — iPhone / iPad premium kurulum sihirbazı (components/InstallCta.tsx açar).
//
// Apple, web sitesinin tek dokunuşla ana ekrana kurulmasına izin vermez; bu
// sihirbaz kurulum yapmaz, yalnız Safari'deki 3 adımı gösterir:
//   1) Paylaş  2) Ana Ekrana Ekle  3) Ekle
// Safari dışında (uygulama içi tarayıcı, Chrome vb.) önce "Safari'de açın"
// ekranı gelir; uygulama içi tarayıcıda 3 adıma geçilmez çünkü orada yoktur.
import { useEffect, useRef, useState } from "react";
import { colors, font } from "@/lib/theme";
import { Icon } from "@/components/Icon";

export type IosEnv = { kind: "safari" | "browser" | "inapp"; app: string | null };

type Screen = "safari" | 0 | 1 | 2;

const G = colors.green;
const DIM = "rgba(255,255,255,0.45)";

function openInSafariHint(app: string | null): string {
  if (app === "Instagram") return "Sağ üstteki ••• simgesine dokunun, “Dış tarayıcıda aç”ı seçin.";
  if (app === "Facebook") return "Sağ üstteki ••• simgesine dokunun, “Dış tarayıcıda aç”ı seçin.";
  if (app === "Google") return "Alttaki Paylaş ya da ••• menüsünden “Safari’de Aç”ı seçin.";
  return "Ekrandaki ••• ya da Paylaş menüsünden “Safari’de Aç” (veya “Tarayıcıda Aç”) seçeneğine dokunun.";
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

// ---- Adım çizimleri (sade, markasız Safari taklidi) ----

function MockShare({ isIpad, env }: { isIpad: boolean; env: IosEnv }) {
  const top = isIpad || env.kind === "browser";
  return (
    <div className="otoiz-iw-mock" aria-hidden="true">
      <div className={`otoiz-iw-bar ${top ? "otoiz-iw-bar-top" : ""}`}>
        {top ? (
          <>
            <span className="otoiz-iw-url">otoizgo.com</span>
            <span className="otoiz-iw-hit">
              <Icon name="share" color={G} size={22} />
            </span>
          </>
        ) : (
          <>
            <Icon name="chevron-left" color={DIM} size={20} />
            <span className="otoiz-iw-url">otoizgo.com</span>
            <span className="otoiz-iw-hit">
              <Icon name="share" color={G} size={22} />
            </span>
            <Icon name="more-horizontal" color={DIM} size={20} />
          </>
        )}
      </div>
    </div>
  );
}

function MockMenu() {
  return (
    <div className="otoiz-iw-mock" aria-hidden="true">
      <div className="otoiz-iw-list">
        <div className="otoiz-iw-row">
          <span>Kopyala</span>
          <Icon name="copy" color={DIM} size={18} />
        </div>
        <div className="otoiz-iw-row otoiz-iw-row-hit">
          <span>Ana Ekrana Ekle</span>
          <Icon name="plus-square" color={G} size={20} />
        </div>
        <div className="otoiz-iw-row">
          <span>Yer İşareti Ekle</span>
          <Icon name="book" color={DIM} size={18} />
        </div>
      </div>
    </div>
  );
}

function MockAdd() {
  return (
    <div className="otoiz-iw-mock" aria-hidden="true">
      <div className="otoiz-iw-addbar">
        <span style={{ color: DIM }}>Vazgeç</span>
        <span className="otoiz-iw-addtitle">Ana Ekrana Ekle</span>
        <span className="otoiz-iw-hit otoiz-iw-hit-text">Ekle</span>
      </div>
      <div className="otoiz-iw-app">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/otoiz-icon-192.png" alt="" width={48} height={48} />
        <span>OTOİZ</span>
      </div>
    </div>
  );
}

export function IosInstallWizard({
  env,
  isIpad,
  onClose,
  onAdded,
  onSnooze,
}: {
  env: IosEnv;
  isIpad: boolean;
  onClose: () => void;
  onAdded: () => void;
  onSnooze: () => void;
}) {
  const [screen, setScreen] = useState<Screen>(env.kind === "safari" ? 0 : "safari");
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const toDevice = isIpad ? "iPad’e" : "iPhone’a";
  const ofDevice = isIpad ? "iPad’inizin" : "iPhone’unuzun";

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    // Arka sayfa kaymasın.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [screen]);

  async function copyLink() {
    const ok = await copyText(window.location.href);
    setCopied(ok ? "ok" : "fail");
  }

  const steps = [
    {
      title: "Safari’nin Paylaş simgesine dokunun",
      text:
        isIpad || env.kind === "browser"
          ? "Adres çubuğunun sağındaki Paylaş simgesine dokunun."
          : "Alt çubuktaki Paylaş simgesine dokunun. Görmüyorsanız önce ••• simgesine dokunun.",
      mock: <MockShare isIpad={isIpad} env={env} />,
    },
    {
      title: "“Ana Ekrana Ekle”ye dokunun",
      text: "Açılan listeyi aşağı kaydırın ve “Ana Ekrana Ekle” seçeneğine dokunun.",
      note: "Seçenek yoksa: listenin sonundaki “Daha Fazla”ya bakın ya da sayfayı Safari’de açın.",
      mock: <MockMenu />,
    },
    {
      title: "Sağ üstte “Ekle”ye dokunun",
      text: `OTOİZ simgesi ${ofDevice} ana ekranına gelir. Artık uygulama gibi tek dokunuşla açılır.`,
      mock: <MockAdd />,
    },
  ];

  return (
    <div className="otoiz-iw-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="otoiz-iw-title"
        className="otoiz-iw-sheet"
        data-testid="install-sheet-ios"
        data-screen={screen === "safari" ? "safari" : `step-${screen + 1}`}
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: font }}
      >
        <div className="otoiz-iw-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/otoiz-icon-192.png" alt="" width={36} height={36} className="otoiz-iw-logo" />
          <div className="otoiz-iw-headtext">
            <div className="otoiz-iw-kicker">Kurulum rehberi</div>
            <div className="otoiz-iw-brand">OTOİZ’i {toDevice} ekleyin</div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Kapat" className="otoiz-iw-close">
            <Icon name="close" color="#fff" size={20} />
          </button>
        </div>

        {screen === "safari" ? (
          <div className="otoiz-iw-body" data-testid="install-open-safari">
            <div className="otoiz-iw-card">
              <span className="otoiz-iw-safari-icon" aria-hidden="true">
                <Icon name="compass" color={G} size={30} />
              </span>
              <h2 id="otoiz-iw-title" ref={headingRef} tabIndex={-1} className="otoiz-iw-title">
                Önce Safari’de açın
              </h2>
              <p className="otoiz-iw-text">
                {env.kind === "inapp"
                  ? `${env.app ? `${env.app} içindeki tarayıcı` : "Bu uygulama içindeki tarayıcı"} OTOİZ’i ana ekrana ekleyemez. Ekleme yalnız Safari’de yapılır.`
                  : `${env.app ?? "Bu tarayıcı"} yerine Safari’de eklemenizi öneririz; en sorunsuz yol budur.`}
              </p>
              <ol className="otoiz-iw-mini">
                <li>
                  <span className="otoiz-iw-mini-no">a</span>
                  <span>{env.kind === "inapp" ? openInSafariHint(env.app) : "Bağlantıyı kopyalayın, Safari’yi açın."}</span>
                </li>
                <li>
                  <span className="otoiz-iw-mini-no">b</span>
                  <span>
                    {env.kind === "inapp"
                      ? "Menü yoksa bağlantıyı kopyalayın, Safari’yi açıp adres çubuğuna yapıştırın."
                      : "Adres çubuğuna yapıştırıp açın."}
                  </span>
                </li>
                <li>
                  <span className="otoiz-iw-mini-no">c</span>
                  <span>Safari’de bu butona tekrar dokunun; 3 adımda ekleyin.</span>
                </li>
              </ol>
            </div>
            <div className="otoiz-iw-actions">
              <button type="button" onClick={copyLink} className="otoiz-iw-primary" style={{ fontFamily: font }}>
                <Icon name={copied === "ok" ? "check" : "copy"} color={colors.textDark} size={20} />
                {copied === "ok" ? "Bağlantı kopyalandı" : "Bağlantıyı kopyala"}
              </button>
              <p className="otoiz-iw-status" role="status" aria-live="polite">
                {copied === "fail" ? "Kopyalanamadı. Adres çubuğundaki bağlantıyı basılı tutup kopyalayın." : ""}
              </p>
              {env.kind === "browser" && (
                <button type="button" onClick={() => setScreen(0)} className="otoiz-iw-secondary" style={{ fontFamily: font }}>
                  Bu tarayıcıda devam et
                </button>
              )}
              <button type="button" onClick={onClose} className="otoiz-iw-quiet" style={{ fontFamily: font }}>
                Kapat
              </button>
            </div>
          </div>
        ) : (
          <div className="otoiz-iw-body">
            <div className="otoiz-iw-progress" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`otoiz-iw-dot ${i <= screen ? "otoiz-iw-dot-on" : ""}`} />
              ))}
            </div>
            <div className="otoiz-iw-card" aria-live="polite">
              <div className="otoiz-iw-stephead">
                <span className="otoiz-iw-no" aria-hidden="true">
                  {screen + 1}
                </span>
                <div>
                  <div className="otoiz-iw-count">Adım {screen + 1} / 3</div>
                  <h2 id="otoiz-iw-title" ref={headingRef} tabIndex={-1} className="otoiz-iw-title">
                    {steps[screen].title}
                  </h2>
                </div>
              </div>
              {steps[screen].mock}
              <p className="otoiz-iw-text">{steps[screen].text}</p>
              {steps[screen].note && <p className="otoiz-iw-note">{steps[screen].note}</p>}
            </div>
            <div className="otoiz-iw-actions">
              {screen < 2 ? (
                <button
                  type="button"
                  onClick={() => setScreen((screen + 1) as Screen)}
                  className="otoiz-iw-primary"
                  style={{ fontFamily: font }}
                >
                  İleri
                  <Icon name="chevron-right" color={colors.textDark} size={20} />
                </button>
              ) : (
                <button type="button" onClick={onAdded} className="otoiz-iw-primary" style={{ fontFamily: font }}>
                  <Icon name="check" color={colors.textDark} size={20} />
                  Ekledim
                </button>
              )}
              <div className="otoiz-iw-row2">
                {screen > 0 ? (
                  <button
                    type="button"
                    onClick={() => setScreen((screen - 1) as Screen)}
                    className="otoiz-iw-secondary"
                    style={{ fontFamily: font }}
                  >
                    Geri
                  </button>
                ) : env.kind !== "safari" ? (
                  <button type="button" onClick={() => setScreen("safari")} className="otoiz-iw-secondary" style={{ fontFamily: font }}>
                    Safari’de açma
                  </button>
                ) : null}
                <button type="button" onClick={onSnooze} className="otoiz-iw-secondary" style={{ fontFamily: font }}>
                  Şimdi değil
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
