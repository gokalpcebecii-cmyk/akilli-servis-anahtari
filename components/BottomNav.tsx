"use client";

import { usePathname, useRouter } from "next/navigation";
import { colors, font } from "@/lib/theme";
import { Icon } from "@/components/Icon";

// PILOT FIX 03 (bölüm E): "Ana Sayfa" ve "Araçlarım" aynı gerçek ekrana
// (araç listesi/karşılama) gidiyordu ve iki AYRI aktif öğe olarak
// gösteriliyordu — canlı testte bulunan bilgi mimarisi tutarsızlığı.
// Tek karar: tek öğe, ekranın gerçek içeriğini yansıtan "Araçlarım" adıyla.
const ITEMS = [
  { key: "home", label: "Araçlarım", href: "/bireysel/araclar", icon: "car" },
  { key: "notifications", label: "Bildirimler", href: "/bireysel/bildirimler", icon: "bell" },
  { key: "profile", label: "Profil", href: "/bireysel/profil", icon: "user" },
];

export function BottomNav({ active }: { active: "home" | "notifications" | "profile" }) {
  const router = useRouter();
  return (
    <nav
      role="navigation"
      aria-label="Alt gezinme"
      className="otoiz-bottom-nav"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        background: colors.surfaceLight,
        borderTop: `1px solid ${colors.border}`,
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom)",
        boxShadow: "0 -4px 20px rgba(6,20,33,0.06)",
      }}
    >
      {ITEMS.map((item) => {
        const isActive = item.key === active;
        const tint = isActive ? colors.greenDark : colors.textMuted;
        return (
          <button
            key={item.key}
            onClick={() => router.push(item.href)}
            aria-current={isActive ? "page" : undefined}
            style={{
              flex: 1,
              minHeight: 56,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: tint,
              fontFamily: font,
              padding: "8px 4px",
            }}
          >
            <Icon name={item.icon} color={tint} size={21} strokeWidth={isActive ? 2.4 : 2} />
            <span style={{ fontSize: 10.5, fontWeight: isActive ? 700 : 500 }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
