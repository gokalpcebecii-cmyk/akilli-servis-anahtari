"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { colors } from "@/lib/theme";
import { Icon } from "@/components/Icon";

export type Benefit = { title: string; desc: string; icon: string };

// Aşama C.1: landing mobil hero'daki fayda kartları. Önceki sürümde 3 sabit
// etiket + tıklanamayan dekoratif noktalar vardı (kaydırılabilir gibi görünüp
// kaymıyordu). Artık gerçek kaydırıcı: CSS scroll-snap ile parmakla kaydırma,
// sol/sağ oklar ve aktif kartı gösteren tıklanabilir noktalar. Desktop'ta
// (≥1040px) bu bileşen gizlenir; aynı liste sağ kolonda tümüyle görünür.
export function BenefitCarousel({ items }: { items: Benefit[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // Oklar bir sonraki hedefi buradan hesaplar: yumuşak kaydırma sürerken
  // ara scroll olayları göstergeyi geçici bir karta çekebilir; art arda
  // hızlı ok basışlarında hedef yine de doğru kartın bir yanı olmalı.
  const targetRef = useRef(0);

  // Aktif kart = izleme alanının sol kenarına en yakın kart. Ok ve nokta
  // tıklamaları da parmakla kaydırma da aynı scroll olayını tetiklediği için
  // gösterge tek kaynaktan güncellenir.
  const syncActive = useCallback((settled: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.children) as HTMLElement[];
    let best = 0;
    let bestDist = Infinity;
    cards.forEach((c, i) => {
      const dist = Math.abs(c.offsetLeft - track.scrollLeft);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    // Son kart izleme alanının soluna hiç yaslanamayabilir (geniş ekran);
    // sona kadar kaydırıldıysa son kartı aktif say.
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) best = cards.length - 1;
    setActive(best);
    if (settled) targetRef.current = best;
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => syncActive(false));
      clearTimeout(settle);
      settle = setTimeout(() => syncActive(true), 160);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      track.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [syncActive]);

  function goTo(i: number) {
    const track = trackRef.current;
    if (!track) return;
    const idx = Math.max(0, Math.min(items.length - 1, i));
    const card = track.children[idx] as HTMLElement | undefined;
    if (!card) return;
    targetRef.current = idx;
    track.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
    setActive(idx);
  }

  const atStart = active === 0;
  const atEnd = active === items.length - 1;

  return (
    <div className="otoiz-benefit-carousel" role="region" aria-roledescription="kaydırıcı" aria-label="OTOİZ faydaları">
      <div ref={trackRef} className="otoiz-benefit-track" data-testid="benefit-track">
        {items.map((b, i) => (
          <div
            key={b.title}
            className="otoiz-benefit-card"
            role="group"
            aria-roledescription="kart"
            aria-label={`${i + 1} / ${items.length}: ${b.title}`}
          >
            <div className="otoiz-benefit-card-icon">
              <Icon name={b.icon} color={colors.green} size={18} />
            </div>
            <div className="otoiz-benefit-card-title">{b.title}</div>
            <div className="otoiz-benefit-card-desc">{b.desc}</div>
          </div>
        ))}
      </div>

      <div className="otoiz-benefit-controls">
        <button
          type="button"
          className="otoiz-benefit-arrow"
          aria-label="Önceki kart"
          onClick={() => goTo(targetRef.current - 1)}
          disabled={atStart}
        >
          <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
            <Icon name="chevron-right" color={colors.textLight} size={16} />
          </span>
        </button>
        <div className="otoiz-benefit-dots">
          {items.map((b, i) => (
            <button
              key={b.title}
              type="button"
              className={`otoiz-benefit-dot${i === active ? " otoiz-benefit-dot-active" : ""}`}
              aria-label={`${i + 1}. karta git: ${b.title}`}
              aria-current={i === active ? "true" : undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <button
          type="button"
          className="otoiz-benefit-arrow"
          aria-label="Sonraki kart"
          onClick={() => goTo(targetRef.current + 1)}
          disabled={atEnd}
        >
          <Icon name="chevron-right" color={colors.textLight} size={16} />
        </button>
      </div>
    </div>
  );
}
