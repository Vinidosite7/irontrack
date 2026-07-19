-- IronTrack Push v2: rode no SQL Editor do Supabase

-- 1) Tabela de subscriptions (um dispositivo por linha)
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription jsonb not null,
  tz text not null default 'America/Sao_Paulo',
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "subs_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "subs_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "subs_update_own" on public.push_subscriptions
  for update using (auth.uid() = user_id);
create policy "subs_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- 2) CRON — rode SOMENTE DEPOIS de deployar a edge function send-reminders.
--    Troque SEU-PROJETO pela ref do projeto e SEU_CRON_SECRET pelo mesmo
--    valor setado em `supabase secrets set CRON_SECRET=...`
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'irontrack-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://SEU-PROJETO.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'SEU_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Pra pausar depois, se precisar:
-- select cron.unschedule('irontrack-reminders');
