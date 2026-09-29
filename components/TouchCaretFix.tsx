"use client";

// OTOİZ Aşama E.1: telefonda tek dokunuşla imleci dokunulan harfe koyar
// (ayrıntı: lib/touchCaret.js). Kök yerleşimde bir kez kurulur.
import { useEffect } from "react";
const { installTouchCaret } = require("@/lib/touchCaret");

export default function TouchCaretFix() {
  useEffect(() => installTouchCaret(document), []);
  return null;
}
