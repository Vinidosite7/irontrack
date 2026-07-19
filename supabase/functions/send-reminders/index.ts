// IronTrack — send-reminders
// Roda a cada minuto via pg_cron. Compara a hora atual (no fuso de cada
// dispositivo) com os horários das refeições e do treino de cada usuário
// e dispara Web Push pra quem ainda não cumpriu.
//
// Deploy:  supabase functions deploy send-reminders --no-verify-jwt
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:voce@email.com CRON_SECRET=um-segredo-forte

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const PHRASES = [
  "Disciplina vence motivação. Todo santo dia. 🔥",
  "O ferro não mente. Bora pagar o preço! 🏋️",
  "Constância é o melhor anabolizante natural. 💪",
  "Ninguém vai levantar o peso por você. Bora!",
  "Shape se constrói na cozinha e na academia. 🍗",
  "Proteína em dia, shape em construção. 💯",
  "Mais uma refeição batida = mais um tijolo no shape. 🧱",
];
const phrase = () => PHRASES[Math.floor(Math.random() * PHRASES.length)];

Deno.serve(async (req) => {
  // só o cron (com o segredo) pode chamar
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("unauthorized", { status: 401 });
  }

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@irontrack.app",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, subscription, tz");
  if (!subs || subs.length === 0) {
    return Response.json({ sent: 0, reason: "no-subs" });
  }

  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const { data: rows } = await supabase
    .from("user_data")
    .select("user_id, data")
    .in("user_id", userIds);
  const byUser = new Map((rows ?? []).map((r) => [r.user_id, r.data]));

  let sent = 0;
  const dead: string[] = [];
  const now = new Date();

  for (const sub of subs) {
    const d: any = byUser.get(sub.user_id);
    if (!d) continue;

    const tz = sub.tz || "America/Sao_Paulo";
    const hhmm = new Intl.DateTimeFormat("pt-BR", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(now);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now); // YYYY-MM-DD

    const checks = d.dietChecks?.[today] ?? {};
    const msgs: { title: string; body: string }[] = [];

    // refeições no horário e ainda não marcadas
    for (const m of d.diet ?? []) {
      if (m.time && m.time === hhmm && !checks[m.id]) {
        msgs.push({ title: `🍗 Hora do ${m.name}!`, body: phrase() });
      }
    }

    // treino no horário e nada registrado hoje
    const trainedToday = Object.values(d.logs ?? {})
      .flat()
      .some((h: any) => h.date === today);
    if (d.profile?.trainTime && d.profile.trainTime === hhmm && !trainedToday) {
      msgs.push({ title: "🏋️ Hora do treino!", body: phrase() });
    }

    for (const msg of msgs) {
      try {
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify({ ...msg, url: "/" }),
        );
        sent++;
      } catch (err: any) {
        // subscription morta (usuário desinstalou/revogou) → limpa
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          dead.push(sub.endpoint);
        }
      }
    }
  }

  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }

  return Response.json({ sent, cleaned: dead.length });
});
