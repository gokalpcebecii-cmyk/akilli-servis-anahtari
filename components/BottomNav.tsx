"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

// OTOİZ Premium — bireysel alanın 5 ana bölümü. Ana ekran
// (/bireysel/araclar) bölümleri aynı sayfa içinde değiştirir (onSelect);
// diğer sayfalardan dokunulunca ana ekranın ilgili bölümüne gidilir.
export type NavKey = "ana" | "aracim" | "belgeler" | "bakim" | "diger";

export const NAV_ITEMS: { key: NavKey; label: string; icon: string }[] = [
  { key: "ana", label: "Ana Sayfa", icon: "home" },
  { key: "aracim", label: "Aracım", icon: "car" },
  { key: "belgeler", label: "Belgeler", icon: "document" },
  { key: "bakim", label: "Bakım", icon: "wrench" },
  { key: "diger", label: "Diğer", icon: "more-horizontal" },
];

export function navHref(key: NavKey) {
  return key === "ana" ? "/bireysel/araclar" : `/bireysel/araclar?bolum=${key}`;
}

function useSelect(onSelect?: (k: NavKey) => void) {
  const router = useRouter();
  return (k: NavKey) => (onSelect ? onSelect(k) : router.push(navHref(k)));
}

// Masaüstünde üst çubukta satır içi gezinme.
export function DesktopNav({ active, onSelect }: { active: NavKey; onSelect?: (k: NavKey) => void }) {
  const select = useSelect(onSelect);
  return (
    <nav aria-label="Masaüstü gezinme" className="oz-nav-desktop">
      {NAV_ITEMS.map((item) => {
        const on = item.key === active;
        return (
          <button key={item.key} type="button" className="oz-nav-item" aria-current={on ? "page" : undefined} onClick={() => select(item.key)}>
            <Icon name={item.icon} color={on ? "#04110A" : "#A3ABB7"} size={16} strokeWidth={on ? 2.4 : 2} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

// Telefonda sabit alt çubuk. desktopFloating: kendi üst çubuğu olmayan
// sayfalarda masaüstünde sağ üstte aynı gezinme gösterilir.
export function BottomNav({ active, onSelect, desktopFloating = true }: { active: NavKey; onSelect?: (k: NavKey) => void; desktopFloating?: boolean }) {
  const select = useSelect(onSelect);
  return (
    <>
      <nav role="navigation" aria-label="Alt gezinme" className="oz-nav otoiz-bottom-nav" data-testid="alt-gezinme">
        <div className="oz-nav-inner">
          {NAV_ITEMS.map((item) => {
            const on = item.key === active;
            return (
              <button key={item.key} type="button" className="oz-nav-item" data-nav={item.key} aria-current={on ? "page" : undefined} onClick={() => select(item.key)}>
                <Icon name={item.icon} color={on ? "#22C55E" : "#6F7783"} size={22} strokeWidth={on ? 2.4 : 2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      {desktopFloating && (
        <div className="otoiz-desktop-nav" style={{ position: "fixed", top: 16, right: 16, zIndex: 40, display: "none" }}>
          <DesktopNav active={active} onSelect={onSelect} />
        </div>
      )}
    </>
  );
}
