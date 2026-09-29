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

function installTouchCaret(doc) {
  const win = doc.defaultView;
  let start = null;

  function onDown(e) {
    start = null;
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    if (!e.isPrimary || !eligible(e.target)) return;
    start = { el: e.target, x: e.clientX, y: e.clientY, t: Date.now() };
  }

  function onUp(e) {
    const st = start;
    start = null;
    if (!st || e.target !== st.el) return;
    // Sürükleme ya da uzun basma (büyüteç) değil, tek dokunuş.
    if (Math.hypot(e.clientX - st.x, e.clientY - st.y) > 10) return;
    if (Date.now() - st.t > 450) return;
    const el = st.el;
    let pos = null;
    try {
      pos = offsetAtPoint(el, e.clientX, e.clientY);
    } catch {
      pos = null;
    }
    if (pos == null) return;
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    el.addEventListener("input", cancel);
    el.addEventListener("keydown", cancel);
    const apply = () => {
      if (cancelled || doc.activeElement !== el) return;
      if (el.selectionStart == null || el.selectionStart !== el.selectionEnd) return; // kullanıcı seçim yaptı
      if (el.selectionStart === pos) return;
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        // seçim desteklemeyen alan
      }
    };
    // Tarayıcı imleci dokunuştan sonra kendi yerleştirir; ardından düzelt.
    for (const d of [0, 60, 160, 320]) win.setTimeout(apply, d);
    win.setTimeout(() => {
      el.removeEventListener("input", cancel);
      el.removeEventListener("keydown", cancel);
    }, 400);
  }

  function onCancel() {
    start = null;
  }

  doc.addEventListener("pointerdown", onDown, true);
  doc.addEventListener("pointerup", onUp, true);
  doc.addEventListener("pointercancel", onCancel, true);
  return () => {
    doc.removeEventListener("pointerdown", onDown, true);
    doc.removeEventListener("pointerup", onUp, true);
    doc.removeEventListener("pointercancel", onCancel, true);
  };
}

module.exports = { eligible, offsetAtPoint, installTouchCaret };
