import { createClient } from "@supabase/supabase-js";
const { validatePassword } = require("@/lib/passwordPolicy");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { full_name, email, password, phone } = body;

    if (!email || !password) {
      return Response.json({ error: "E-posta ve şifre zorunlu." }, { status: 400 });
    }
    const pwError = validatePassword(password);
    if (pwError) {
      return Response.json({ error: pwError }, { status: 400 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || null, phone: phone || null, account_type: "individual" },
    });

    if (error) {
      const message = error.message?.includes("already registered")
        ? "Bu e-posta ile zaten bir hesap var."
        : error.message || "Hesap oluşturulamadı.";
      return Response.json({ error: message }, { status: 400 });
    }

    return Response.json({ ok: true, user_id: data.user?.id });
  } catch (e: any) {
    return Response.json({ error: e.message || "Sunucu hatası." }, { status: 500 });
  }
}
