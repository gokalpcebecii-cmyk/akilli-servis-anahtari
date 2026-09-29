"use strict";

// OTOİZ Aşama E.1 (telefon testi düzeltmesi): dokunulan harfe imleç.
//
// Sorun: iPhone Safari (ve bazı Android klavyeleri) metin kutusuna tek
// dokunuşta imleci dokunulan harfe değil, en yakın KELİME sınırına koyar.
// E-postada "gokalp.cebeci@gmail.com" nokta ve @ ile kelimelere bölündüğü,
// km'de "84.200" noktayla ikiye ayrıldığı için kullanıcı ortadaki bir harfe
// ya da rakama imleci getiremez.
//
// Çözüm: dokunmatik bir TEK dokunuşta, dokunulan noktadaki harf sırası
// hesaplanır ve tarayıcı imleci yerleştirdikten hemen sonra imleç tam o
// harfe konur. Hesap, input'un görünümünün (yazı tipi, boşluklar, kaydırma)
// görünmez bir kopyası üzerinde tarayıcının kendi "noktadaki harf" ölçümüyle
// yapılır. Uzun basma (büyüteç), sürükleme, çift dokunuş (kelime seçme) ve
// fare/klavye kullanımına dokunulmaz. Şifre alanları hariç tutulur.

const TEXT_TYPES = new Set(["text", "search", "tel", "url", ""]);

const COPY_PROPS = [
  "direction",
  "box-sizing",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "font-style",
  "font-variant",
  "font-weight",
  "font-stretch",
  "font-size",
  "font-family",
  "font-feature-settings",
  "font-kerning",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-align",
  "text-transform",
  "text-indent",
  "text-rendering",
  "tab-size",
];

function eligible(el) {
  if (!el || el.disabled || el.readOnly) return false;
  if (el.closest && el.closest("[data-native-caret]")) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;
  return TEXT_TYPES.has(String(el.getAttribute("type") || "").toLowerCase());
}

// Ekrandaki (x, y) noktasına denk gelen karakter sırası; bulunamazsa null.
function offsetAtPoint(el, x, y) {
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  const cs = win.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const isArea = el.tagName === "TEXTAREA";
  const value = String(el.value || "");
  if (!value) return 0;

  const m = doc.createElement("div");
  for (const p of COPY_PROPS) m.style.setProperty(p, cs.getPropertyValue(p));
  const s = m.style;
  s.position = "fixed";
  s.left = rect.left + "px";
  s.top = rect.top + "px";
  s.width = rect.width + "px";
  s.height = rect.height + "px";
  s.boxSizing = "border-box";
  s.margin = "0";
  s.borderStyle = "solid";
  s.borderColor = "transparent";
  s.overflow = "hidden";
  s.opacity = "0";
  s.zIndex = "2147483647";
  s.pointerEvents = "auto";
  s.userSelect = "text";
  s.webkitUserSelect = "text";
  if (isArea) {
    s.whiteSpace = "pre-wrap";
    s.overflowWrap = "break-word";
  } else {
    // Tek satır: yazı kutunun dikey ortasında dursun.
    const bt = parseFloat(cs.borderTopWidth) || 0;
    const bb = parseFloat(cs.borderBottomWidth) || 0;
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    const inner = Math.max(1, rect.height - bt - bb - pt - pb);
    s.whiteSpace = "pre";
    s.lineHeight = inner + "px";
  }
  const text = doc.createTextNode(value);
  m.appendChild(text);
  doc.body.appendChild(m);
  try {
    m.scrollLeft = el.scrollLeft;
    m.scrollTop = el.scrollTop;
    // Nokta kopyanın içinde kalsın (kenara çok yakın dokunuşlar).
    const px = Math.min(Math.max(x, rect.left + 1), rect.right - 1);
    const py = isArea ? Math.min(Math.max(y, rect.top + 1), rect.bottom - 1) : rect.top + rect.height / 2;
    let node = null;
    let off = 0;
    if (doc.caretRangeFromPoint) {
      const r = doc.caretRangeFromPoint(px, py);
      if (r) {
        node = r.startContainer;
        off = r.startOffset;
      }
    } else if (doc.caretPositionFromPoint) {
      const p = doc.caretPositionFromPoint(px, py);
      if (p) {
        node = p.offsetNode;
        off = p.offset;
      }
    }
    if (node === text) return Math.max(0, Math.min(off, value.length));
    if (node === m) return off === 0 ? 0 : value.length;
    return null;
  } finally {
    m.remove();
  }
}

// iPhone'da tek dokunuşun imleci yerleştirmesi, çift dokunuş (kelime seçme)
// ihtimali beklendiği için dokunuştan ~300-450 ms SONRA olur ve kelime
// sınırına yapışır. Bu yüzden sabit zamanlayıcılar yetmez: dokunuştan sonraki
// kısa süre boyunca her imleç değişiminde (selectionchange) imleç, dokunulan
// harfe geri konur. Kullanıcı yazmaya başlarsa, seçim yaparsa (çift dokunuş,
// uzun basma) ya da başka alana geçerse hemen bırakılır.
const HOLD_MS = 900;

function installTouchCaret(doc) {
  const win = doc.defaultView;
  let start = null;
  let active = null; // { el, pos, until, stop }

  function release() {
    if (active) active.stop();
    active = null;
  }

  function begin(x, y, t) {
    const el = doc.elementFromPoint(x, y);
    if (!eligible(el)) {
      start = null;
      return;
    }
    start = { el, x, y, t };
  }

  function end(x, y) {
    const st = start;
    start = null;
    if (!st) return;
    // Sürükleme ya da uzun basma (büyüteç) değil, tek dokunuş.
    if (Math.hypot(x - st.x, y - st.y) > 10) return;
    if (Date.now() - st.t > 450) return;
    const el = st.el;
    let pos = null;
    try {
      pos = offsetAtPoint(el, x, y);
    } catch {
      pos = null;
    }
    if (pos == null) return;
    release();
    const a = { el, pos, until: Date.now() + HOLD_MS, stop: () => {} };
    const apply = () => {
      if (active !== a) return;
      if (Date.now() > a.until) return release();
      if (doc.activeElement !== el) return; // odak henüz gelmediyse bekle
      if (el.selectionStart == null) return;
      if (el.selectionStart !== el.selectionEnd) return release(); // kullanıcı seçim yaptı
      if (el.selectionStart === pos) return;
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        release();
      }
    };
    const stopOnInput = () => release();
    const timers = [0, 60, 160, 320, 480, 650, 850].map((d) => win.setTimeout(apply, d));
    doc.addEventListener("selectionchange", apply);
    el.addEventListener("input", stopOnInput);
    el.addEventListener("keydown", stopOnInput);
    el.addEventListener("blur", stopOnInput);
    a.stop = () => {
      timers.forEach((id) => win.clearTimeout(id));
      doc.removeEventListener("selectionchange", apply);
      el.removeEventListener("input", stopOnInput);
      el.removeEventListener("keydown", stopOnInput);
      el.removeEventListener("blur", stopOnInput);
    };
    active = a;
    win.setTimeout(() => {
      if (active === a) release();
    }, HOLD_MS + 50);
  }

  // Dokunma olayları iPhone ve Android'de en güvenilir kaynak; olmayan
  // ortamlarda dokunmatik pointer olayları kullanılır.
  const hasTouch = "ontouchstart" in win;
  function onTouchStart(e) {
    if (e.touches.length !== 1) {
      start = null;
      return;
    }
    const t = e.touches[0];
    begin(t.clientX, t.clientY, Date.now());
  }
  function onTouchEnd(e) {
    const t = e.changedTouches[0];
    if (t) end(t.clientX, t.clientY);
  }
  function onTouchCancel() {
    start = null;
  }
  function onPointerDown(e) {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    if (!e.isPrimary) return;
    begin(e.clientX, e.clientY, Date.now());
  }
  function onPointerUp(e) {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    end(e.clientX, e.clientY);
  }

  const opts = { capture: true, passive: true };
  if (hasTouch) {
    doc.addEventListener("touchstart", onTouchStart, opts);
    doc.addEventListener("touchend", onTouchEnd, opts);
    doc.addEventListener("touchcancel", onTouchCancel, opts);
  } else {
    doc.addEventListener("pointerdown", onPointerDown, opts);
    doc.addEventListener("pointerup", onPointerUp, opts);
    doc.addEventListener("pointercancel", onTouchCancel, opts);
  }
  return () => {
    release();
    doc.removeEventListener("touchstart", onTouchStart, opts);
    doc.removeEventListener("touchend", onTouchEnd, opts);
    doc.removeEventListener("touchcancel", onTouchCancel, opts);
    doc.removeEventListener("pointerdown", onPointerDown, opts);
    doc.removeEventListener("pointerup", onPointerUp, opts);
    doc.removeEventListener("pointercancel", onTouchCancel, opts);
  };
}

module.exports = { eligible, offsetAtPoint, installTouchCaret };
