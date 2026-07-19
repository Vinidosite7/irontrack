import { createClient } from "@supabase/supabase-js";

// Precisa de SUPABASE_SERVICE_ROLE_KEY nas envs do servidor (Vercel > Settings > Environment
// Variables) — NUNCA prefixa com NEXT_PUBLIC_, essa chave não pode vazar pro client.
// Pega em: Supabase Dashboard > Project Settings > API > service_role.

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return Response.json({ error: "no-token" }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return Response.json({ error: "not-configured" }, { status: 500 });

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // valida o token do usuário que está pedindo a exclusão (só pode excluir a própria conta)
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return Response.json({ error: "invalid-token" }, { status: 401 });

    const userId = userData.user.id;

    // user_data e push_subscriptions têm FK "on delete cascade" pra auth.users,
    // mas apagamos explicitamente antes por segurança/clareza.
    await admin.from("user_data").delete().eq("user_id", userId);
    await admin.from("push_subscriptions").delete().eq("user_id", userId);

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) return Response.json({ error: delErr.message }, { status: 500 });

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
