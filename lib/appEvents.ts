// OTOİZ P1 — Sistem Sağlığı olay kaydı (yalnız sunucu). Kayıt başarısız olursa
// isteği asla bozmaz; en fazla günlüğe yazar.
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
const { EVENT_KINDS, safeRoute, safeCode } = require("@/lib/appEventsCore");

export async function logAppEvent(kind: string, route?: string | null, status?: number | null, detail?: Record<string, any> | null) {
  if (!EVENT_KINDS.has(kind)) return;
  try {
    const { error } = await createServerSupabase().rpc("log_app_event", {
      p_kind: kind,
      p_route: safeRoute(route),
      p_status: status ?? null,
      p_detail: detail ?? null,
    });
    if (error) console.error("[otoiz] log_app_event:", error.message);
  } catch (e: any) {
    console.error("[otoiz] log_app_event:", e?.message);
  }
}

type Handler<C> = (req: any, ctx: C) => Promise<Response> | Response;

// API route sarmalayıcısı: yakalanmamış hata → 500 + "api_5xx" olayı;
// handler'ın kendisi 5xx döndürürse de olay yazılır.
export function withApiLog<C = any>(route: string, handler: Handler<C>): Handler<C> {
  return async (req: any, ctx: C) => {
    try {
      const res = await handler(req, ctx);
      if (res && res.status >= 500) await logAppEvent("api_5xx", route, res.status, { method: req?.method ?? null });
      return res;
    } catch (e: any) {
      console.error(`[otoiz] ${route} beklenmeyen hata:`, e?.message);
      await logAppEvent("api_5xx", route, 500, { method: req?.method ?? null, code: safeCode(e) });
      return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
    }
  };
}
