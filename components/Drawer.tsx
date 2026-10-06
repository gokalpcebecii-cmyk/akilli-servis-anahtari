"use client";

// OTOİZ Nihai UX son düzenleme — odaklı işlem penceresi. Masaüstü/tablette
// sağdan açılan panel (drawer), telefonda tam ekran ayrı odaklı ekran.
// Genel Bakış bilgi odaklı kalır; formlar (Bakım Kaydı, KM Güncelle) burada.
import { useEffect, useRef } from "react";
import { colors, font } from "@/lib/theme";
import { Icon } from "@/components/Icon";

export function Drawer({
  open,
  title,
  onClose,
  testId,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  testId?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Klavye yalnız ilk alan için açılsın diye ilk giriş alanına odaklan;
    // alan yoksa panelin kendisine.
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>("input, select, textarea");
      (first ?? panelRef.current)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="otoiz-drawer-root" style={{ fontFamily: font }}>
      <div className="otoiz-drawer-backdrop" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="otoiz-drawer-title"
        data-testid={testId}
        tabIndex={-1}
        className="otoiz-drawer-panel"
      >
        <div className="otoiz-drawer-head">
          <h2 id="otoiz-drawer-title" style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: 0 }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            style={{ width: 44, height: 44, borderRadius: "50%", border: `1px solid ${colors.border}`, background: colors.surfaceRaised, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <Icon name="close" color={colors.text} size={18} />
          </button>
        </div>
        <div className="otoiz-drawer-body">{children}</div>
      </div>
    </div>
  );
}
