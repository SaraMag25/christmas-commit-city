# Configuração do Backend Supabase + GitHub OAuth (Fase 6)

Este guia descreve como colocar o **Christmas Commit City** em produção com **GitHub OAuth**, banco PostgreSQL blindado com **RLS estrito + RPCs atômicas** e **Edge Function** segura (`sync-github-contributions`).

---

## 1. Criar Projeto no Supabase e Configurar o GitHub OAuth

1. Crie um projeto no [Supabase Dashboard](https://supabase.com/dashboard) e anote seu **Project Ref** (`<seu-project-ref>`).
2. No painel **Authentication → Providers → GitHub**, copie a **Callback URL** exata:
   ```text
   https://<seu-project-ref>.supabase.co/auth/v1/callback
   ```
3. No GitHub, acesse **Settings → Developer settings → OAuth Apps → New OAuth App** e preencha:
   - **Application name:** `Christmas Commit City`
   - **Homepage URL:** `https://seu-dominio.com` (ou `https://seu-projeto.pages.dev` / `http://localhost:5173`)
   - **Authorization callback URL:** `https://<seu-project-ref>.supabase.co/auth/v1/callback`
4. Copie o **Client ID** e o **Client Secret** do GitHub e cole em **Authentication → Providers → GitHub** no Supabase (ative o provider).
5. Em **Authentication → URL Configuration** no Supabase:
   - **Site URL:** `https://seu-dominio.com` (ou `http://localhost:5173`)
   - **Redirect URLs:** adicione `http://localhost:5173` e `https://seu-dominio.com/**` (e `https://seu-projeto.pages.dev/**` se usar preview do Cloudflare Pages).

> **Escopo mínimo:** o app solicita apenas `read:user` — **nunca** acesso de escrita aos repositórios.

---

## 2. Variáveis de Ambiente (`.env` / Cloudflare Pages vs Secrets do Supabase)

### Frontend (`.env` local e Environment Variables na Cloudflare Pages)
Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Preencha **apenas** variáveis públicas `VITE_*` (nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no frontend):

```env
VITE_SUPABASE_URL=https://<seu-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-chave-anon-publica>
VITE_CONTRIBUTION_YEAR=2026
VITE_PIX_KEY=<sua-chave-pix>
VITE_PIX_BR_CODE=<seu-pix-copia-e-cola>
VITE_PIX_RECIPIENT_NAME=<seu-nome>
VITE_PIX_RECIPIENT_CITY=<sua-cidade>
```

### Backend (Secrets da Edge Function no Supabase)
As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente nas Edge Functions do Supabase. Configure adicionalmente:

```bash
# Origens permitidas para CORS em produção (separadas por vírgula)
npx supabase secrets set ALLOWED_ORIGINS="https://seu-dominio.com,http://localhost:5173"

# Token de leitura pública do GitHub para busca universal de qualquer @username (`resolve-github-tree`)
# e fallback de re-sincronização (`sync-github-contributions`)
npx supabase secrets set GITHUB_TOKEN="github_pat_seu_token_leitura_publica"

# Segredos da Fase 7 — Pagamentos Reais (Pix Mercado Pago + Cartão Internacional Stripe)
npx supabase secrets set MERCADOPAGO_ACCESS_TOKEN="APP_USR-seu-token"
npx supabase secrets set MERCADOPAGO_WEBHOOK_SECRET="sua-assinatura-secreta-mp"
npx supabase secrets set STRIPE_SECRET_KEY="sk_live_ou_test_sua_chave"
npx supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_sua_assinatura_stripe"
```

---

## 3. Aplicar Migrations SQL e Fazer Deploy das Edge Functions

No diretório raiz do projeto:

```bash
# 1. Autenticar e vincular ao projeto Supabase
npx supabase login
npx supabase link --project-ref <seu-project-ref>

# 2. Aplicar todas as migrations SQL (Fase 6 + Fase 7 preços/pagamentos)
npx supabase db push

# 3. Fazer deploy das Edge Functions (validação JWT interna + webhooks HMAC + busca universal)
npx supabase functions deploy sync-github-contributions --no-verify-jwt
npx supabase functions deploy resolve-github-tree --no-verify-jwt
npx supabase functions deploy create-pix-payment --no-verify-jwt
npx supabase functions deploy webhook-mercadopago --no-verify-jwt
npx supabase functions deploy create-stripe-checkout --no-verify-jwt
npx supabase functions deploy webhook-stripe --no-verify-jwt
```

### Seed inicial da cidade (150–250 contas reais do GitHub)

Com as variáveis `VITE_SUPABASE_URL` (ou `SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY` e `GITHUB_TOKEN` disponíveis no shell ou `.env`:

```bash
npm run seed:city
```

### URLs dos Webhooks (Fase 7)
- **Mercado Pago (`webhook-mercadopago`):**
  `https://<seu-project-ref>.supabase.co/functions/v1/webhook-mercadopago` (marque evento **Pagamentos / `payment`** e copie a chave secreta para `MERCADOPAGO_WEBHOOK_SECRET`).
- **Stripe (`webhook-stripe`):**
  `https://<seu-project-ref>.supabase.co/functions/v1/webhook-stripe` (eventos **`checkout.session.completed`**, **`checkout.session.async_payment_succeeded`**, **`checkout.session.expired`** e **`checkout.session.async_payment_failed`**; copie o signing secret `whsec_...` para `STRIPE_WEBHOOK_SECRET`).

> **Alternativa pelo painel Web:** caso prefira aplicar o SQL manualmente, execute todas as migrations em `supabase/migrations/` em ordem cronológica no **SQL Editor** do Supabase (incluindo [`2026112504_pix_exclusive_items.sql`](../supabase/migrations/2026112504_pix_exclusive_items.sql) e [`2026112505_creator_full_unlock.sql`](../supabase/migrations/2026112505_creator_full_unlock.sql)).

---

## 4. Deploy do Frontend na Cloudflare Pages (Domínio Próprio)

1. Conecte o repositório na **Cloudflare Pages**:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
2. O arquivo [`public/_redirects`](../public/_redirects) (`/* /index.html 200`) garante rotas SPA e [`functions/tree/[username].ts`](../functions/tree/%5Busername%5D.ts) injeta meta tags Open Graph/Twitter dinâmicas em `/tree/:username`.
3. Adicione em **Settings → Environment variables** (Production) apenas variáveis públicas `VITE_*`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_CONTRIBUTION_YEAR=2026`
   - `VITE_SITE_URL` (opcional, origem canônica pública ex.: `https://christmas-commit-city.pages.dev`)
   - Opcionais de campanha: `VITE_PIX_KEY`, `VITE_PIX_BR_CODE`, `VITE_PIX_RECIPIENT_NAME`, `VITE_PIX_RECIPIENT_CITY`
4. Ao ativar seu domínio próprio (ex.: `https://seu-dominio.com`), atualize:
   - **GitHub OAuth App** (Homepage URL) e **Supabase → Authentication → URL Configuration** (`Site URL` + `Redirect URLs`).
   - Segredo CORS das Edge Functions:
     ```bash
     npx supabase secrets set ALLOWED_ORIGINS="https://seu-dominio.com,http://localhost:5173"
     ```

---

## 4. Checklist Rápido de Teste de Segurança

Execute estes testes no console do navegador ou via `curl`/Postman usando a chave `anon` e um JWT de usuário autenticado:

1. **Bloqueio de escrita direta (forjar commits / desbloquear itens):**
   - Tente um `POST /rest/v1/trees` ou `PATCH /rest/v1/trees?user_id=eq.<uid>` com `{ "total_commits": 99999 }` usando `anon` ou o JWT do usuário.
   - **Resultado esperado:** HTTP `401` / `403` (`permission denied for table trees`).
   - Tente inserir diretamente em `user_unlocks`, `tree_gifts` ou `payment_orders` via REST.
   - **Resultado esperado:** HTTP `401` / `403` (escrita bloqueada para clientes).

2. **Privacidade de remetentes de presentes:**
   - Como visitante anônimo (`anon`) ou logado com outro usuário (`Usuário B`), consulte `/rest/v1/tree_gifts?select=*`.
   - **Resultado esperado:** array vazio `[]` (ninguém além do dono `auth.uid() = recipient_user_id` enxerga `sender_username`).
   - Consulte `/rest/v1/public_trees?select=*` e `/rest/v1/rpc/get_public_tree_gift_counts`.
   - **Resultado esperado:** retorna árvores públicas sem `user_id`/`spent_commits` e apenas contagens agregadas `(recipient_tree_id, gift_id, gift_count)` sem remetentes.

3. **Bloqueio de presente pago gratuito e rate limit:**
   - Tente chamar `/rest/v1/rpc/send_free_gift` passando `p_gift_id: "gift-retro-pc"` ou `"gift-teddy"`.
   - **Resultado esperado:** erro `GIFT_NOT_FREE_OR_INVALID`.
   - Envie mais de 10 presentes gratuitos em menos de 10 minutos.
   - **Resultado esperado:** erro `RATE_LIMIT_SENDER_WINDOW`.

4. **Proteção contra gasto duplo de commits (race condition) e spoof no sync:**
   - Chame `unlock_item_with_commits` em paralelo 2x rápidas para o mesmo item ou sem saldo suficiente.
   - **Resultado esperado:** o lock `FOR UPDATE` impede cobrança dupla e bloqueia saldo insuficiente com `INSUFFICIENT_COMMITS`.
   - Chame `sync-github-contributions` enviando `username` de outra pessoa no body; confirme que a função ignora o body e sincroniza apenas a identidade GitHub verificada do JWT, respeitando o cooldown de 5 minutos.
