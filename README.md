# IronTrack 🏋️

Treino, dieta e evolução — PWA em Next.js + Supabase.

## Setup (10 min)

### 1. Supabase
1. Cria um projeto novo em [supabase.com](https://supabase.com) (free tier resolve).
2. No **SQL Editor**, cola e roda o conteúdo de `supabase/schema.sql`.
3. Em **Authentication > Providers > Email**: se quiser entrar direto sem confirmar e-mail, desativa "Confirm email".
4. Em **Project Settings > API**, copia a `URL` e a `anon public key`.

### 2. Local
```bash
cp .env.local.example .env.local
# edita o .env.local com a URL e anon key do passo anterior
npm install
npm run dev
```
Abre http://localhost:3000, cria sua conta e testa.

### 3. Deploy na Vercel
Importa o repo em [vercel.com/new](https://vercel.com/new) (detecta Next.js sozinho) e adiciona as envs antes do deploy:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API > service_role — **sem** prefixo NEXT_PUBLIC, é só server-side)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (se for configurar o push agora — ver seção abaixo)

Depois de conectado, `git push` já deploya sozinho. Pra forçar manual: `vercel --prod`.

### 4. Recuperação de senha (opcional, recomendado)
1. Supabase Dashboard → Authentication → Providers → Email → ativa **"Confirm email"** se quiser confirmação de cadastro também.
2. Authentication → URL Configuration → **Site URL** = tua URL de produção (ex: `https://irontrack.vercel.app`). É pra onde o link de redefinição/confirmação manda o usuário.
3. O e-mail nativo do Supabase é limitado (uso só de dev). Pra produção, configura SMTP customizado em Authentication → SMTP Settings — recomendo [Resend](https://resend.com) (free tier generoso, 5 min de setup).
4. Authentication → Email Templates → traduz os templates pra PT-BR se quiser (vêm em inglês).

O fluxo "Esqueci minha senha" na tela de login e a página `/reset-password` já estão prontos — só depende do SMTP estar configurado pra o e-mail chegar.

### 4. Instalar no iPhone
1. Abre a URL de produção **no Safari** (tem que ser Safari).
2. Botão de compartilhar → **"Adicionar à Tela de Início"**.
3. Abre pelo ícone — roda em tela cheia, com notch respeitado, igual app nativo.

## Arquitetura
- **Dados**: Supabase é a fonte da verdade (tabela `user_data`, 1 linha JSONB por usuário, RLS ligado — cada um só vê o seu). `localStorage` funciona como cache: escrita local instantânea + sync com debounce de 1,2s pra nuvem. Offline continua funcionando; sincroniza quando voltar.
- **Auth**: e-mail + senha via Supabase Auth.
- **PWA**: `manifest.json` + `sw.js` (network-first com fallback em cache) + meta tags iOS no layout.

## Limitações conhecidas (iOS)
- **Timer de descanso** não conta com a tela bloqueada (iOS congela JS em background).
- **Notificações** de refeição/treino disparam com o app aberto. Push real com app fechado = fase 2: Web Push com VAPID + handler no `sw.js` (iOS 16.4+, app instalado na home). O esqueleto do listener já tá comentado no `sw.js`.
- Multi-dispositivo funciona (dados na nuvem), mas sem merge: vale o último que salvou.

## Push com app fechado (v2) — setup

1. **Gerar VAPID keys** (uma vez):
   ```bash
   npx web-push generate-vapid-keys
   ```
2. **Client**: coloca a public key no `.env.local` e na Vercel:
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY=...` → redeploy.
3. **Tabela**: roda `supabase/push.sql` (parte 1) no SQL Editor.
4. **Edge Function** (precisa do [Supabase CLI](https://supabase.com/docs/guides/cli)):
   ```bash
   supabase login
   supabase link --project-ref SEU-PROJETO
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:voce@email.com CRON_SECRET=um-segredo-forte
   supabase functions deploy send-reminders --no-verify-jwt
   ```
5. **Cron**: roda a parte 2 do `push.sql` (troca a URL do projeto e o CRON_SECRET). A função roda a cada minuto e só envia quando bate horário de refeição/treino não cumprido.
6. **No iPhone**: app instalado pela tela de início (iOS 16.4+) → Perfil → "Ativar notificações". Pronto: push chega com o app fechado.

Teste manual da função:
```bash
curl -X POST https://SEU-PROJETO.supabase.co/functions/v1/send-reminders -H "x-cron-secret: SEU_CRON_SECRET"
```

## Fase 2 (backlog)
- Exportar/importar backup JSON
- Histórico de medidas com data + gráfico
- Base de alimentos BR
