"use client";

// OTOİZ Aşama E.1: imleç (caret) kaymasını önleyen input.
//
// Sorun: değer yazarken biçimlendirilen alanlarda (km'de binlik nokta,
// plakada büyük harf, yalnız rakam) React, biçimlenmiş değeri input'a
// yeniden yazar ve tarayıcı imleci en sona atar. Ortadan düzeltme yapan
// kullanıcı, yazdığı her harfte imlecin sona kaçtığını görür (özellikle
// iPhone Safari ve Android Chrome'da).
//
// Çözüm: değişiklik anında imleçten önceki "anlamlı" karakter (harf/rakam)
// sayısı saklanır; yeni değer çizildikten sonra imleç aynı sayıda anlamlı
// karakterin hemen arkasına geri konur. Biçim değişmediyse (değer yazıldığı
// gibi kaldıysa) hiçbir şeye dokunulmaz.
import { forwardRef, useLayoutEffect, useRef } from "react";
import type { InputHTMLAttributes } from "react";

const { charsFor, countSignificant, caretAfterSignificant } = require("@/lib/caret");

type Props = InputHTMLAttributes<HTMLInputElement> & {
  // Hangi karakterler değeri taşır: km gibi alanlarda yalnız rakam.
  caretChars?: "alnum" | "digits";
};

export const CaretSafeInput = forwardRef<HTMLInputElement, Props>(function CaretSafeInput({ onChange, value, caretChars = "alnum", ...rest }, forwarded) {
  const re = charsFor(caretChars);
  const inner = useRef<HTMLInputElement | null>(null);
  const pending = useRef<{ n: number; raw: string } | null>(null);

  function restore() {
    const el = inner.current;
    const p = pending.current;
    if (!el || !p) return;
    pending.current = null;
    if (typeof document !== "undefined" && document.activeElement !== el) return;
    if (el.value === p.raw) return; // biçim değişmedi: tarayıcının imleci doğru
    const pos = caretAfterSignificant(el.value, p.n, re);
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      // type="number"/"email" gibi seçim desteklemeyen alanlar: dokunma
    }
  }

  useLayoutEffect(restore, [value]);

  return (
    <input
      {...rest}
      ref={(el) => {
        inner.current = el;
        if (typeof forwarded === "function") forwarded(el);
        else if (forwarded) forwarded.current = el;
      }}
      value={value}
      onChange={(e) => {
        const el = e.currentTarget;
        const at = el.selectionStart;
        if (at != null) {
          pending.current = { n: countSignificant(el.value.slice(0, at), re), raw: el.value };
          // Değer aynı kaldıysa (ör. rakam alanına harf) yeniden çizim olmaz;
          // React input'u eski değere geri yazar, imleci de sonraki karede düzelt.
          if (typeof window !== "undefined") window.requestAnimationFrame(restore);
        }
        onChange?.(e);
      }}
    />
  );
});
